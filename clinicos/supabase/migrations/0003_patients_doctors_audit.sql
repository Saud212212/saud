-- =============================================================================
-- ClinicOS — المرحلة 2: المرضى والأطباء وسجل التدقيق
-- الجداول: audit_logs, patients, doctors
-- يلتزم بـ CLAUDE.md: clinic_id + RLS + فهارس + صلاحيات حسب الدور.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) audit_logs — سجل العمليات الحساسة (القانون #5)
--    append-only: لا توجد سياسات UPDATE/DELETE. الكتابة تُقيَّد بـ actor والعيادة.
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid references public.clinics(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action        text not null check (action in ('create', 'update', 'delete', 'archive', 'restore')),
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_audit_logs_clinic_id   on public.audit_logs(clinic_id);
create index if not exists idx_audit_logs_entity       on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created_at   on public.audit_logs(created_at desc);

comment on table public.audit_logs is 'سجل العمليات الحساسة (append-only). عمود clinic_id للعزل.';

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

-- الكتابة فقط بصفة الفاعل الحالي وعيادته (منع التزوير). لا UPDATE/DELETE → غير قابل للتعديل.
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (
    actor_user_id = auth.uid()
    and (clinic_id = private.current_clinic_id() or private.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- 2) patients — المرضى
-- -----------------------------------------------------------------------------
create table if not exists public.patients (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  file_number   integer not null,
  full_name     text not null,
  phone         text,
  email         text,
  gender        text check (gender in ('male', 'female')),
  age           integer check (age is null or (age >= 0 and age <= 150)),
  date_of_birth date,
  address       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint patients_clinic_file_unique unique (clinic_id, file_number)
);
-- فهارس على الحقول كثيرة البحث
create index if not exists idx_patients_clinic_id   on public.patients(clinic_id);
create index if not exists idx_patients_phone       on public.patients(clinic_id, phone);
create index if not exists idx_patients_file_number on public.patients(clinic_id, file_number);
create index if not exists idx_patients_full_name   on public.patients(clinic_id, full_name);

comment on table public.patients is 'المرضى. عمول clinic_id للعزل، file_number فريد داخل العيادة.';

-- توليد file_number تلقائياً متسلسلاً لكل عيادة (مع قفل لمنع التعارض)
create or replace function public.set_patient_file_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.file_number is null then
    -- قفل على مستوى المعاملة لكل عيادة لمنع تكرار الأرقام عند الإدراج المتزامن
    perform pg_advisory_xact_lock(hashtext(new.clinic_id::text));
    select coalesce(max(file_number), 0) + 1
      into new.file_number
      from public.patients
     where clinic_id = new.clinic_id;
  end if;
  return new;
end;
$$;
drop trigger if exists set_patient_file_number on public.patients;
create trigger set_patient_file_number before insert on public.patients
  for each row execute function public.set_patient_file_number();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at before update on public.patients
  for each row execute function public.set_updated_at();

alter table public.patients enable row level security;

-- عرض: كل أفراد العيادة (أي دور) أو super_admin
drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

-- إضافة: clinic_admin و receptionist داخل عيادتهم، أو super_admin
drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'receptionist'))
  );

-- تعديل (يشمل الأرشفة soft delete): clinic_admin و receptionist داخل عيادتهم
drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients for update to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'receptionist'))
  )
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'receptionist'))
  );

-- حذف نهائي: clinic_admin فقط (الواجهة تستخدم الأرشفة عادةً)
drop policy if exists patients_delete on public.patients;
create policy patients_delete on public.patients for delete to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );

-- -----------------------------------------------------------------------------
-- 3) doctors — الأطباء (مرتبط بـ users عبر user_id الاختياري، جاهز لحساب دخول لاحقاً)
-- -----------------------------------------------------------------------------
create table if not exists public.doctors (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  user_id        uuid references public.users(id) on delete set null,
  full_name      text not null,
  specialty      text,
  phone          text,
  email          text,
  license_number text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint doctors_user_unique unique (user_id)
);
create index if not exists idx_doctors_clinic_id on public.doctors(clinic_id);
create index if not exists idx_doctors_phone     on public.doctors(clinic_id, phone);
create index if not exists idx_doctors_full_name on public.doctors(clinic_id, full_name);

comment on table public.doctors is 'الأطباء. عمود clinic_id للعزل، user_id اختياري لربط حساب دخول لاحقاً.';

drop trigger if exists set_doctors_updated_at on public.doctors;
create trigger set_doctors_updated_at before update on public.doctors
  for each row execute function public.set_updated_at();

alter table public.doctors enable row level security;

-- عرض: كل أفراد العيادة أو super_admin
drop policy if exists doctors_select on public.doctors;
create policy doctors_select on public.doctors for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

-- كتابة (إضافة/تعديل/حذف): clinic_admin داخل عيادته، أو super_admin
drop policy if exists doctors_insert on public.doctors;
create policy doctors_insert on public.doctors for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );

drop policy if exists doctors_update on public.doctors;
create policy doctors_update on public.doctors for update to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  )
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );

drop policy if exists doctors_delete on public.doctors;
create policy doctors_delete on public.doctors for delete to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );
