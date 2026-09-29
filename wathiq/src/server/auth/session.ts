import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { withOrg, withUser } from "../db/client";
import { memberships, organizations, users } from "../db/schema";
import { env } from "../env";
import type { RequestMeta } from "../services/audit";
import { decodeDevSession, encodeDevSession } from "./dev-login";

/**
 * جلسة مؤقتة للمراحل 1–4: كوكي موقّعة بـ HMAC تحمل معرّف المستخدم.
 * تُستبدل في المرحلة 5 بـ Better Auth (كلمات مرور، روابط سحرية، دعوات).
 * المؤسسة والدور يُقرآن من قاعدة البيانات في كل طلب — لا يُوثق بهما من الكوكي.
 */
export const SESSION_COOKIE = "wathiq_session";

export const encodeSession = (userId: string) => encodeDevSession(env().SESSION_SECRET, userId);
const decodeSession = (raw: string | undefined) => decodeDevSession(env().SESSION_SECRET, raw);

export interface Session {
  userId: string;
  userName: string;
  orgId: string;
  orgName: string;
  role: "owner" | "editor" | "reviewer";
}

export async function getSession(): Promise<Session | null> {
  const userId = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const me = await withUser(userId, async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId));
    const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId)).limit(1);
    return u && m ? { user: u, membership: m } : null;
  });
  if (!me) return null;

  const org = await withOrg({ orgId: me.membership.orgId, userId }, async (tx) => {
    const [o] = await tx.select().from(organizations).where(eq(organizations.id, me.membership.orgId));
    const [m] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.orgId, me.membership.orgId), eq(memberships.userId, userId)));
    return o && m ? { name: o.name, role: m.role } : null;
  });
  if (!org) return null;

  return { userId, userName: me.user.name, orgId: me.membership.orgId, orgName: org.name, role: org.role };
}

/** للصفحات: يعيد التوجيه لصفحة الدخول إن لم توجد جلسة. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export const ctxOf = (s: Session) => ({ orgId: s.orgId, userId: s.userId });

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}
