import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export type AuditAction = "create" | "update" | "delete" | "archive" | "restore";

/**
 * يسجّل عملية حساسة في جدول audit_logs (القانون #5).
 * الـ RLS تفرض أن actor_user_id = المستخدم الحالي وأن clinic_id = عيادته،
 * فلا يمكن تزوير الفاعل أو العيادة. السجل غير قابل للتعديل (append-only).
 *
 * يُستدعى من Server Actions بعد نجاح العملية. لا يرمي استثناءً حتى لا يُفشل
 * العملية الأساسية إن تعذّر التسجيل؛ يكتفي بتسجيل الخطأ في السجل.
 */
export async function logAudit(params: {
  actorUserId: string;
  clinicId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: params.actorUserId,
      clinic_id: params.clinicId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: (params.metadata ?? {}) as Json,
    });
    if (error) {
      console.error("[audit] فشل تسجيل العملية:", error.message);
    }
  } catch (err) {
    console.error("[audit] خطأ غير متوقع أثناء التسجيل:", err);
  }
}
