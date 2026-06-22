import type { UserRole } from "@/types/database";

export type Resource =
  | "clinics"
  | "users"
  | "patients"
  | "doctors"
  | "appointments"
  | "medical_records"
  | "prescriptions"
  | "invoices"
  | "payments"
  | "subscriptions"
  | "audit_logs"
  | "files"
  | "reports";

export type Action = "create" | "read" | "update" | "delete";

// Capability matrix mirroring the RLS policies in supabase/migrations/0002.
// "own" means the row must belong to the acting doctor (enforced in DB).
type Capability = Action[] | "all";

const MATRIX: Record<UserRole, Partial<Record<Resource, Capability>>> = {
  super_admin: {
    clinics: "all",
    users: "all",
    patients: "all",
    doctors: "all",
    appointments: "all",
    medical_records: "all",
    prescriptions: "all",
    invoices: "all",
    payments: "all",
    subscriptions: "all",
    audit_logs: ["read"],
    files: "all",
    reports: ["read"],
  },
  clinic_admin: {
    clinics: ["read", "update"],
    users: "all",
    patients: "all",
    doctors: "all",
    appointments: "all",
    medical_records: ["read"],
    prescriptions: ["read"],
    invoices: "all",
    payments: "all",
    subscriptions: ["read"],
    audit_logs: ["read"],
    files: "all",
    reports: ["read"],
  },
  doctor: {
    patients: ["read"],
    appointments: ["read", "update"],
    medical_records: "all", // own only, enforced by RLS
    prescriptions: "all", // own only, enforced by RLS
    files: ["create", "read"],
  },
  receptionist: {
    patients: "all",
    appointments: "all",
    doctors: ["read"],
    invoices: "all",
    payments: "all",
    files: ["create", "read"],
  },
};

export function can(role: UserRole, action: Action, resource: Resource): boolean {
  const cap = MATRIX[role]?.[resource];
  if (!cap) return false;
  if (cap === "all") return true;
  return cap.includes(action);
}

// Landing route for each role after sign-in.
export function homeForRole(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "clinic_admin":
      return "/dashboard";
    case "doctor":
      return "/doctor";
    case "receptionist":
      return "/reception";
  }
}
