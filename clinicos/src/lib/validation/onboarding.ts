import * as z from "zod";

/** مخطط إنشاء عيادة جديدة مع حساب مديرها (super_admin). */
export const clinicOnboardingSchema = z.object({
  clinic_name: z
    .string({ error: "اسم العيادة مطلوب." })
    .trim()
    .min(2, { error: "اسم العيادة قصير جداً." })
    .max(150, { error: "اسم العيادة طويل جداً." }),
  slug: z
    .string({ error: "المُعرّف (slug) مطلوب." })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, {
      error: "المُعرّف يجب أن يكون أحرفاً إنجليزية صغيرة وأرقاماً وشرطات (3–40).",
    }),
  plan: z.enum(["free", "basic", "pro", "enterprise"]).default("free"),
  admin_full_name: z
    .string({ error: "اسم المدير مطلوب." })
    .trim()
    .min(2, { error: "اسم المدير قصير جداً." })
    .max(150),
  admin_email: z.email({ error: "بريد إلكتروني غير صالح." }).trim().toLowerCase(),
  admin_password: z
    .string({ error: "كلمة المرور مطلوبة." })
    .min(8, { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." })
    .max(72, { error: "كلمة المرور طويلة جداً." }),
});

export type ClinicOnboardingInput = z.infer<typeof clinicOnboardingSchema>;
