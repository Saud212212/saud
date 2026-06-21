import * as z from "zod";

/**
 * مخطط التحقق من بيانات تسجيل الدخول.
 * يُستخدم على الخادم (Server Action) — التحقق لا يعتمد على الواجهة وحدها.
 */
export const loginSchema = z.object({
  email: z.email({ error: "يرجى إدخال بريد إلكتروني صالح." }).trim(),
  password: z
    .string()
    .min(8, { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** حالة نموذج تسجيل الدخول المُعادة من Server Action. */
export type LoginFormState = {
  errors?: {
    email?: string[];
    password?: string[];
  };
  message?: string;
} | undefined;
