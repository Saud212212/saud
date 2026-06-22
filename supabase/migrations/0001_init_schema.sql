-- ============================================================================
-- ClinicOS — 0001 Initial Schema
-- Multi-tenant clinic management SaaS. Every tenant row carries clinic_id.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type clinic_status        as enum ('active', 'suspended', 'inactive');
create type subscription_tier    as enum ('basic', 'pro', 'enterprise');
create type subscription_status  as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid');
create type user_role            as enum ('super_admin', 'clinic_admin', 'doctor', 'receptionist');
create type gender_type          as enum ('male', 'female');
create type appointment_status   as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
create type appointment_type     as enum ('consultation', 'follow_up', 'emergency', 'procedure');
create type invoice_status       as enum ('paid', 'unpaid', 'partially_paid');
create type payment_method       as enum ('cash', 'card', 'online');
create type payment_status       as enum ('succeeded', 'pending', 'failed');
create type file_type            as enum ('pdf', 'image', 'lab_result');
create type notification_type    as enum ('appointment_reminder', 'appointment_confirmation', 'appointment_cancellation', 'payment_received');
create type notification_channel as enum ('email', 'sms', 'whatsapp');

-- ----------------------------------------------------------------------------
-- 1. clinics
-- ----------------------------------------------------------------------------
create table public.clinics (
  id                     uuid primary key default uuid_generate_v4(),
  name                   text not null,
  slug                   text not null unique,
  address                text,
  phone                  text,
  email                  text,
  logo_url               text,
  status                 clinic_status default 'active' not null,
  subscription_tier      subscription_tier default 'basic' not null,
  subscription_status    subscription_status default 'trialing' not null,
  stripe_customer_id     text,
  stripe_subscription_id text,
  trial_ends_at          timestamptz,
  created_at             timestamptz default now() not null,
  updated_at             timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 2. users  (profile rows mirroring auth.users)
-- ----------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  clinic_id   uuid references public.clinics(id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  role        user_role not null default 'receptionist',
  avatar_url  text,
  is_active   boolean default true not null,
  last_login  timestamptz,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 3. patients
-- ----------------------------------------------------------------------------
create table public.patients (
  id                  uuid primary key default uuid_generate_v4(),
  clinic_id           uuid not null references public.clinics(id) on delete cascade,
  file_number         text not null,
  full_name           text not null,
  phone               text,
  email               text,
  gender              gender_type,
  date_of_birth       date,
  age                 integer generated always as (
                        case when date_of_birth is null then null
                        else extract(year from age(date_of_birth))::int end
                      ) stored,
  address             text,
  chronic_diseases    text[] default '{}',
  allergies           text[] default '{}',
  previous_surgeries  text[] default '{}',
  current_medications text[] default '{}',
  notes               text,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null,
  unique (clinic_id, file_number)
);

-- ----------------------------------------------------------------------------
-- 4. doctors
-- ----------------------------------------------------------------------------
create table public.doctors (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references public.users(id) on delete set null,
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  specialization   text,
  license_number   text,
  working_hours    jsonb default '{"days": [], "start": "09:00", "end": "17:00"}'::jsonb,
  consultation_fee numeric(10,2) default 0,
  is_active        boolean default true not null,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 5. appointments
-- ----------------------------------------------------------------------------
create table public.appointments (
  id                  uuid primary key default uuid_generate_v4(),
  clinic_id           uuid not null references public.clinics(id) on delete cascade,
  patient_id          uuid not null references public.patients(id) on delete cascade,
  doctor_id           uuid not null references public.doctors(id) on delete cascade,
  receptionist_id     uuid references public.users(id) on delete set null,
  appointment_date    date not null,
  appointment_time    time not null,
  duration_minutes    integer default 30 not null,
  status              appointment_status default 'pending' not null,
  type                appointment_type default 'consultation' not null,
  notes               text,
  cancellation_reason text,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 6. medical_records
-- ----------------------------------------------------------------------------
create table public.medical_records (
  id             uuid primary key default uuid_generate_v4(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  doctor_id      uuid not null references public.doctors(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  diagnosis      text,
  symptoms       text,
  treatment_plan text,
  notes          text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 7. prescriptions
-- ----------------------------------------------------------------------------
create table public.prescriptions (
  id                uuid primary key default uuid_generate_v4(),
  clinic_id         uuid not null references public.clinics(id) on delete cascade,
  medical_record_id uuid references public.medical_records(id) on delete cascade,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  doctor_id         uuid not null references public.doctors(id) on delete cascade,
  medications       jsonb default '[]'::jsonb, -- [{name, dosage, frequency, duration, notes}]
  instructions      text,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 8. invoices
-- ----------------------------------------------------------------------------
create table public.invoices (
  id             uuid primary key default uuid_generate_v4(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  invoice_number text not null,
  items          jsonb default '[]'::jsonb, -- [{description, quantity, unit_price, total}]
  subtotal       numeric(10,2) default 0 not null,
  tax_amount     numeric(10,2) default 0 not null,
  discount       numeric(10,2) default 0 not null,
  total_amount   numeric(10,2) default 0 not null,
  amount_paid    numeric(10,2) default 0 not null,
  status         invoice_status default 'unpaid' not null,
  payment_method payment_method,
  notes          text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  unique (clinic_id, invoice_number)
);

-- ----------------------------------------------------------------------------
-- 9. payments
-- ----------------------------------------------------------------------------
create table public.payments (
  id                       uuid primary key default uuid_generate_v4(),
  clinic_id                uuid not null references public.clinics(id) on delete cascade,
  invoice_id               uuid not null references public.invoices(id) on delete cascade,
  amount                   numeric(10,2) not null,
  payment_method           payment_method not null,
  stripe_payment_intent_id text,
  stripe_charge_id         text,
  status                   payment_status default 'pending' not null,
  paid_at                  timestamptz,
  created_at               timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 10. subscriptions (SaaS billing)
-- ----------------------------------------------------------------------------
create table public.subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  clinic_id              uuid not null references public.clinics(id) on delete cascade,
  stripe_subscription_id text,
  stripe_price_id        text,
  tier                   subscription_tier not null default 'basic',
  status                 subscription_status not null default 'trialing',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false not null,
  created_at             timestamptz default now() not null,
  updated_at             timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 11. audit_logs
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  clinic_id   uuid references public.clinics(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 12. files
-- ----------------------------------------------------------------------------
create table public.files (
  id          uuid primary key default uuid_generate_v4(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  patient_id  uuid references public.patients(id) on delete cascade,
  file_name   text not null,
  file_type   file_type not null,
  file_url    text not null,
  file_size   integer,
  uploaded_by uuid references public.users(id) on delete set null,
  description text,
  created_at  timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- 13. notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  user_id    uuid references public.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  type       notification_type not null,
  channel    notification_channel not null default 'email',
  title      text,
  content    text,
  is_read    boolean default false not null,
  sent_at    timestamptz,
  created_at timestamptz default now() not null
);

-- ----------------------------------------------------------------------------
-- Indexes (clinic_id on every tenant table + common lookups)
-- ----------------------------------------------------------------------------
create index idx_users_clinic              on public.users (clinic_id);
create index idx_patients_clinic           on public.patients (clinic_id);
create index idx_patients_name             on public.patients (clinic_id, full_name);
create index idx_doctors_clinic            on public.doctors (clinic_id);
create index idx_doctors_user              on public.doctors (user_id);
create index idx_appointments_clinic       on public.appointments (clinic_id);
create index idx_appointments_doctor_date  on public.appointments (doctor_id, appointment_date);
create index idx_appointments_patient      on public.appointments (patient_id);
create index idx_appointments_date         on public.appointments (clinic_id, appointment_date);
create index idx_medical_records_clinic    on public.medical_records (clinic_id);
create index idx_medical_records_patient   on public.medical_records (patient_id);
create index idx_prescriptions_clinic      on public.prescriptions (clinic_id);
create index idx_prescriptions_patient     on public.prescriptions (patient_id);
create index idx_invoices_clinic           on public.invoices (clinic_id);
create index idx_invoices_patient          on public.invoices (patient_id);
create index idx_payments_clinic           on public.payments (clinic_id);
create index idx_payments_invoice          on public.payments (invoice_id);
create index idx_subscriptions_clinic      on public.subscriptions (clinic_id);
create index idx_audit_logs_clinic         on public.audit_logs (clinic_id);
create index idx_audit_logs_entity         on public.audit_logs (entity_type, entity_id);
create index idx_files_clinic              on public.files (clinic_id);
create index idx_files_patient             on public.files (patient_id);
create index idx_notifications_user        on public.notifications (user_id, is_read);
