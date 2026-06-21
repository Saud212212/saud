import * as z from "zod";

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(5000).nullable().optional(),
);

/** مخطط السجل الطبي (ملخّص واحد لكل مريض). */
export const medicalRecordSchema = z.object({
  chronic_diseases: optionalText,
  allergies: optionalText,
  past_surgeries: optionalText,
  current_medications: optionalText,
  notes: optionalText,
});

export type MedicalRecordInput = z.infer<typeof medicalRecordSchema>;

/** دواء واحد في الوصفة. */
export const medicationSchema = z.object({
  name: z.string().trim().min(1, { error: "اسم الدواء مطلوب." }).max(200),
  dose: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(100).nullable().optional(),
  ),
  frequency: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(100).nullable().optional(),
  ),
});

export type Medication = z.infer<typeof medicationSchema>;

/** مخطط الوصفة الطبية. */
export const prescriptionSchema = z.object({
  patient_id: z.uuid({ error: "مريض غير صالح." }),
  medications: z
    .array(medicationSchema)
    .min(1, { error: "أضف دواءً واحداً على الأقل." }),
  dosage: optionalText,
  notes: optionalText,
});

export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

/** مخطط الموعد. */
export const appointmentSchema = z.object({
  patient_id: z.uuid({ error: "مريض غير صالح." }),
  doctor_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.uuid().nullable().optional(),
  ),
  scheduled_at: z
    .string({ error: "وقت الموعد مطلوب." })
    .min(1, { error: "وقت الموعد مطلوب." }),
  notes: optionalText,
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

/** أنواع الملفات المسموح برفعها وأقصى حجم. */
export const ALLOWED_FILE_TYPES = ["pdf", "xray", "lab", "other"] as const;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
