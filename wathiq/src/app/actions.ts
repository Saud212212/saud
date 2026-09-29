"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, encodeSession } from "@/server/auth/session";
import { DEV_USERS } from "@/server/dev-users";
import { assertDevLoginEnabled } from "@/server/auth/dev-login";
import { LOCALE_COOKIE } from "@/i18n/request";

const cookieBase = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/** دخول تجريبي (المراحل 1–4). يعمل فقط مع DEV_LOGIN=true وخارج الإنتاج. */
export async function devLogin(formData: FormData) {
  assertDevLoginEnabled();
  const user = DEV_USERS.find((u) => u.id === formData.get("userId"));
  if (!user) throw new Error("unknown user");
  (await cookies()).set(SESSION_COOKIE, encodeSession(user.id), { ...cookieBase, maxAge: 60 * 60 * 12 });
  redirect("/tenders");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function switchLocale(formData: FormData) {
  const next = formData.get("locale") === "en" ? "en" : "ar";
  (await cookies()).set(LOCALE_COOKIE, next, { ...cookieBase, httpOnly: false, maxAge: 60 * 60 * 24 * 365 });
  const back = String(formData.get("back") ?? "/tenders");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/tenders");
}
