import * as z from "zod";

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalString = z.preprocess(
  emptyToNull,
  z.string().trim().max(200).nullable().optional(),
);

/** مخطط التحقق من بيانات الطبيب (يُستخدم على الخادم). */
export const doctorSchema = z.object({
  full_name: z
    .string({ error: "اسم الطبيب مطلوب." })
    .trim()
    .min(2, { error: "الاسم يجب ألا يقل عن حرفين." })
    .max(200, { error: "الاسم طويل جداً." }),
  specialty: optionalString,
  phone: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/, { error: "رقم هاتف غير صالح." })
      .nullable()
      .optional(),
  ),
  email: z.preprocess(
    emptyToNull,
    z.email({ error: "بريد إلكتروني غير صالح." }).nullable().optional(),
  ),
  license_number: optionalString,
});

export type DoctorInput = z.infer<typeof doctorSchema>;
