// ClinicOS database types.
// In a live project these are generated with:
//   supabase gen types typescript --project-id <id> > src/types/database.ts
// This hand-maintained version mirrors supabase/migrations and is enough to
// keep the app type-safe until the generated file replaces it.

export type UserRole = "super_admin" | "clinic_admin" | "doctor" | "receptionist";
export type ClinicStatus = "active" | "suspended" | "inactive";
export type SubscriptionTier = "basic" | "pro" | "enterprise";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";
export type Gender = "male" | "female";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";
export type AppointmentType = "consultation" | "follow_up" | "emergency" | "procedure";
export type InvoiceStatus = "paid" | "unpaid" | "partially_paid";
export type PaymentMethod = "cash" | "card" | "online";
export type PaymentStatus = "succeeded" | "pending" | "failed";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  status: ClinicStatus;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  clinic_id: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  clinic_id: string;
  file_number: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  age: number | null;
  address: string | null;
  chronic_diseases: string[];
  allergies: string[];
  previous_surgeries: string[];
  current_medications: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  user_id: string | null;
  clinic_id: string;
  specialization: string | null;
  license_number: string | null;
  working_hours: { days: string[]; start: string; end: string } | null;
  consultation_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  receptionist_id: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  type: AppointmentType;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  invoice_number: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
