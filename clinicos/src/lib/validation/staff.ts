import * as z from "zod";

/** الأدوار التي يجوز لمدير العيادة إسنادها (لا يشمل super_admin). */
export const ASSIGNABLE_ROLES = [
  "clinic_admin",
  "doctor",
  "receptionist",
] as const;

/** مخطط تعديل بيانات موظف (مستخدم موجود) — يُستخدم على الخادم. */
export const staffUpdateSchema = z.object({
  full_name: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().min(2, { error: "الاسم قصير جداً." }).max(200).nullable().optional(),
  ),
  role: z.enum(ASSIGNABLE_ROLES, { error: "الدور غير صالح." }),
  is_active: z.preprocess(
    (v) => v === "true" || v === true || v === "on",
    z.boolean(),
  ),
});

export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

/** مخطط إنشاء حساب موظف جديد (مع كلمة مرور ابتدائية) — clinic_admin. */
export const staffCreateSchema = z.object({
  full_name: z
    .string({ error: "الاسم مطلوب." })
    .trim()
    .min(2, { error: "الاسم قصير جداً." })
    .max(200),
  email: z.email({ error: "بريد إلكتروني غير صالح." }).trim().toLowerCase(),
  role: z.enum(ASSIGNABLE_ROLES, { error: "الدور غير صالح." }),
  password: z
    .string({ error: "كلمة المرور مطلوبة." })
    .min(8, { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." })
    .max(72, { error: "كلمة المرور طويلة جداً." }),
});

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
