import * as z from "zod";

/** يحوّل القيم النصية الفارغة إلى null (حقول اختيارية قادمة من نموذج HTML). */
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalString = z.preprocess(
  emptyToNull,
  z.string().trim().max(200).nullable().optional(),
);

/** مخطط التحقق من بيانات المريض (يُستخدم على الخادم). */
export const patientSchema = z.object({
  full_name: z
    .string({ error: "اسم المريض مطلوب." })
    .trim()
    .min(2, { error: "الاسم يجب ألا يقل عن حرفين." })
    .max(200, { error: "الاسم طويل جداً." }),
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
  gender: z.preprocess(
    emptyToNull,
    z.enum(["male", "female"], { error: "الجنس غير صالح." }).nullable().optional(),
  ),
  age: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z
      .number()
      .int({ error: "العمر يجب أن يكون رقماً صحيحاً." })
      .min(0, { error: "العمر غير صالح." })
      .max(150, { error: "العمر غير صالح." })
      .nullable()
      .optional(),
  ),
  date_of_birth: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "تاريخ غير صالح." })
      .nullable()
      .optional(),
  ),
  address: optionalString,
});

export type PatientInput = z.infer<typeof patientSchema>;
