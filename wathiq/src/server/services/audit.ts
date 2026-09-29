import { auditLogs } from "../db/schema";
import type { OrgContext, Tx } from "../db/client";

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export async function audit(
  tx: Tx,
  ctx: OrgContext & { actorKind?: "user" | "worker" | "system" },
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  req?: RequestMeta,
) {
  await tx.insert(auditLogs).values({
    orgId: ctx.orgId,
    actorUserId: ctx.userId ?? null,
    actorKind: ctx.actorKind ?? "user",
    action,
    entityType,
    entityId,
    metadata,
    ip: req?.ip ?? null,
    userAgent: req?.userAgent?.slice(0, 300) ?? null,
  });
}
