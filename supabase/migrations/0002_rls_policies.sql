-- ============================================================================
-- ClinicOS — 0002 Row Level Security
-- Strict multi-tenant isolation keyed on clinic_id + role-based capabilities.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid recursive RLS on public.users)
-- ----------------------------------------------------------------------------
create or replace function public.auth_clinic_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select clinic_id from public.users where id = auth.uid();
$$;

create or replace function public.auth_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.users where id = auth.uid()), false);
$$;

-- True when the row's clinic matches the caller's clinic, or caller is super admin.
create or replace function public.same_clinic(target uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_super_admin() or target = public.auth_clinic_id();
$$;

-- The doctor row owned by the current auth user (if any).
create or replace function public.auth_doctor_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.doctors where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS on all tenant tables
-- ----------------------------------------------------------------------------
alter table public.clinics         enable row level security;
alter table public.users           enable row level security;
alter table public.patients        enable row level security;
alter table public.doctors         enable row level security;
alter table public.appointments    enable row level security;
alter table public.medical_records enable row level security;
alter table public.prescriptions   enable row level security;
alter table public.invoices        enable row level security;
alter table public.payments        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.files           enable row level security;
alter table public.notifications   enable row level security;

-- ----------------------------------------------------------------------------
-- clinics
-- ----------------------------------------------------------------------------
create policy clinics_select on public.clinics for select
  using (public.is_super_admin() or id = public.auth_clinic_id());

create policy clinics_super_all on public.clinics for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Clinic admins may update (settings) their own clinic.
create policy clinics_admin_update on public.clinics for update
  using (id = public.auth_clinic_id() and public.auth_role() = 'clinic_admin')
  with check (id = public.auth_clinic_id());

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
create policy users_self_select on public.users for select
  using (id = auth.uid() or public.same_clinic(clinic_id));

-- Self profile updates (e.g. last_login, avatar).
create policy users_self_update on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Clinic admins & super admins manage staff in their clinic.
create policy users_admin_all on public.users for all
  using (public.is_super_admin() or (public.auth_role() = 'clinic_admin' and clinic_id = public.auth_clinic_id()))
  with check (public.is_super_admin() or (public.auth_role() = 'clinic_admin' and clinic_id = public.auth_clinic_id()));

-- ----------------------------------------------------------------------------
-- patients — admins & receptionists CRUD; doctors read-only.
-- ----------------------------------------------------------------------------
create policy patients_select on public.patients for select
  using (public.same_clinic(clinic_id));

create policy patients_write on public.patients for all
  using (
    clinic_id = public.auth_clinic_id()
    and public.auth_role() in ('clinic_admin', 'receptionist')
  )
  with check (
    clinic_id = public.auth_clinic_id()
    and public.auth_role() in ('clinic_admin', 'receptionist')
  );

create policy patients_super on public.patients for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- doctors
-- ----------------------------------------------------------------------------
create policy doctors_select on public.doctors for select
  using (public.same_clinic(clinic_id));

create policy doctors_admin_write on public.doctors for all
  using (clinic_id = public.auth_clinic_id() and public.auth_role() = 'clinic_admin')
  with check (clinic_id = public.auth_clinic_id() and public.auth_role() = 'clinic_admin');

create policy doctors_super on public.doctors for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- appointments — admins & receptionists CRUD; doctors read own + update status.
-- ----------------------------------------------------------------------------
create policy appointments_select on public.appointments for select
  using (public.same_clinic(clinic_id));

create policy appointments_reception_write on public.appointments for all
  using (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist'))
  with check (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist'));

create policy appointments_doctor_update on public.appointments for update
  using (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id())
  with check (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id());

create policy appointments_super on public.appointments for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- medical_records — doctors CRUD own; admins read; super read.
-- ----------------------------------------------------------------------------
create policy medical_records_select on public.medical_records for select
  using (
    public.is_super_admin()
    or (clinic_id = public.auth_clinic_id() and public.auth_role() = 'clinic_admin')
    or (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id())
  );

create policy medical_records_doctor_write on public.medical_records for all
  using (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id())
  with check (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id());

create policy medical_records_super on public.medical_records for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- prescriptions — same model as medical_records.
-- ----------------------------------------------------------------------------
create policy prescriptions_select on public.prescriptions for select
  using (
    public.is_super_admin()
    or (clinic_id = public.auth_clinic_id() and public.auth_role() = 'clinic_admin')
    or (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id())
  );

create policy prescriptions_doctor_write on public.prescriptions for all
  using (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id())
  with check (clinic_id = public.auth_clinic_id() and doctor_id = public.auth_doctor_id());

create policy prescriptions_super on public.prescriptions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- invoices — admins & receptionists CRUD; doctors read.
-- ----------------------------------------------------------------------------
create policy invoices_select on public.invoices for select
  using (public.same_clinic(clinic_id));

create policy invoices_write on public.invoices for all
  using (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist'))
  with check (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist'));

create policy invoices_super on public.invoices for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------
create policy payments_select on public.payments for select
  using (public.same_clinic(clinic_id));

create policy payments_write on public.payments for all
  using (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist'))
  with check (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist'));

create policy payments_super on public.payments for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- subscriptions — read within clinic; only super admin / service role writes.
-- ----------------------------------------------------------------------------
create policy subscriptions_select on public.subscriptions for select
  using (public.same_clinic(clinic_id));

create policy subscriptions_super on public.subscriptions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- audit_logs — read within clinic; inserts happen via SECURITY DEFINER trigger.
-- ----------------------------------------------------------------------------
create policy audit_logs_select on public.audit_logs for select
  using (public.same_clinic(clinic_id));

-- ----------------------------------------------------------------------------
-- files
-- ----------------------------------------------------------------------------
create policy files_select on public.files for select
  using (public.same_clinic(clinic_id));

create policy files_write on public.files for all
  using (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist', 'doctor'))
  with check (clinic_id = public.auth_clinic_id() and public.auth_role() in ('clinic_admin', 'receptionist', 'doctor'));

create policy files_super on public.files for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- notifications — users see their own; clinic admins see clinic-wide.
-- ----------------------------------------------------------------------------
create policy notifications_select on public.notifications for select
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (clinic_id = public.auth_clinic_id() and public.auth_role() = 'clinic_admin')
  );

create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_write on public.notifications for insert
  with check (clinic_id = public.auth_clinic_id() or public.is_super_admin());
