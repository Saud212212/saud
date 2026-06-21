/**
 * تعريفات نظام الصلاحيات RBAC والثوابت المشتركة.
 */

/** الأدوار الأربعة الثابتة في النظام. */
export const ROLES = [
  "super_admin",
  "clinic_admin",
  "doctor",
  "receptionist",
] as const;

export type AppRole = (typeof ROLES)[number];

/** المسار الذي يُوجَّه إليه كل دور بعد تسجيل الدخول. */
export const ROLE_HOME: Record<AppRole, string> = {
  super_admin: "/admin",
  clinic_admin: "/dashboard",
  doctor: "/doctor",
  receptionist: "/reception",
};

/** يتحقق أن القيمة دور صالح. */
export function isAppRole(value: string | null | undefined): value is AppRole {
  return !!value && (ROLES as readonly string[]).includes(value);
}

/** يُعيد المسار الرئيسي لدور معيّن، مع مسار افتراضي آمن. */
export function homePathForRole(role: string | null | undefined): string {
  return isAppRole(role) ? ROLE_HOME[role] : "/login";
}

// -----------------------------------------------------------------------------
// مصفوفة الصلاحيات (Capabilities) — مصدر الحقيقة لإظهار/إخفاء الإجراءات في الواجهة.
// التحقق النهائي يبقى على الخادم وفي RLS؛ هذه للواجهة فقط.
// -----------------------------------------------------------------------------

/** هل يستطيع الدور إدارة المرضى (إضافة/تعديل/أرشفة)؟ */
export function canManagePatients(role: AppRole): boolean {
  return role === "clinic_admin" || role === "receptionist";
}

/** هل يستطيع الدور إدارة الأطباء؟ */
export function canManageDoctors(role: AppRole): boolean {
  return role === "clinic_admin";
}

/** هل يستطيع الدور إدارة الموظفين (المستخدمين)؟ */
export function canManageStaff(role: AppRole): boolean {
  return role === "clinic_admin";
}

/** هل يرى الدور البيانات السريرية (السجل الطبي/الوصفات)؟ الاستقبال محجوب. */
export function canViewClinical(role: AppRole): boolean {
  return role === "clinic_admin" || role === "doctor";
}

/** هل يكتب الدور السجل الطبي (التشخيص)؟ */
export function canWriteMedicalRecord(role: AppRole): boolean {
  return role === "clinic_admin" || role === "doctor";
}

/** هل يكتب الدور الوصفات؟ الأطباء فقط. */
export function canWritePrescription(role: AppRole): boolean {
  return role === "doctor";
}

/** هل يدير الدور المواعيد؟ */
export function canManageAppointments(role: AppRole): boolean {
  return role === "clinic_admin" || role === "receptionist";
}

/** هل يرفع الدور الملفات؟ */
export function canUploadFiles(role: AppRole): boolean {
  return role === "clinic_admin" || role === "doctor" || role === "receptionist";
}
