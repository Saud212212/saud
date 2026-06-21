-- =============================================================================
-- ClinicOS — المرحلة 5: السجلات الطبية والوصفات والملفات والمواعيد
-- بيانات طبية بالغة الحساسية — أعلى مستوى حماية (RLS صارمة + عزل تخزين).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- medical_records — سجل طبي واحد لكل مريض (ملخّص قابل للتحديث)
-- عرض/كتابة: clinic_admin + doctor فقط (receptionist محجوب — بيانات سريرية)
-- -----------------------------------------------------------------------------
create table if not exists public.medical_records (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references public.clinics(id) on delete cascade,
  patient_id          uuid not null unique references public.patients(id) on delete cascade,
  chronic_diseases    text,
  allergies           text,
  past_surgeries      text,
  current_medications text,
  notes               text,
  updated_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_medical_records_clinic_id on public.medical_records(clinic_id);

drop trigger if exists set_medical_records_updated_at on public.medical_records;
create trigger set_medical_records_updated_at before update on public.medical_records
  for each row execute function public.set_updated_at();

alter table public.medical_records enable row level security;

drop policy if exists medical_records_select on public.medical_records;
create policy medical_records_select on public.medical_records for select to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor'))
  );

drop policy if exists medical_records_insert on public.medical_records;
create policy medical_records_insert on public.medical_records for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor'))
  );

drop policy if exists medical_records_update on public.medical_records;
create policy medical_records_update on public.medical_records for update to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor'))
  )
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor'))
  );

-- -----------------------------------------------------------------------------
-- prescriptions — الوصفات الطبية (متعددة لكل مريض)
-- كتابة: doctor فقط؛ عرض: clinic_admin + doctor
-- -----------------------------------------------------------------------------
create table if not exists public.prescriptions (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  doctor_id   uuid references public.doctors(id) on delete set null,
  medications jsonb not null default '[]'::jsonb,
  dosage      text,
  notes       text,
  date        date not null default current_date,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_prescriptions_clinic_id  on public.prescriptions(clinic_id);
create index if not exists idx_prescriptions_patient_id on public.prescriptions(patient_id);

alter table public.prescriptions enable row level security;

drop policy if exists prescriptions_select on public.prescriptions;
create policy prescriptions_select on public.prescriptions for select to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor'))
  );

drop policy if exists prescriptions_insert on public.prescriptions;
create policy prescriptions_insert on public.prescriptions for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'doctor')
  );

drop policy if exists prescriptions_delete on public.prescriptions;
create policy prescriptions_delete on public.prescriptions for delete to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor'))
  );

-- -----------------------------------------------------------------------------
-- files — البيانات الوصفية للملفات (الملف نفسه في Storage)
-- عرض/رفع: كل أفراد العيادة؛ حذف: clinic_admin
-- -----------------------------------------------------------------------------
create table if not exists public.files (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  file_type   text not null check (file_type in ('pdf', 'xray', 'lab', 'other')),
  uploaded_by uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_files_clinic_id  on public.files(clinic_id);
create index if not exists idx_files_patient_id on public.files(patient_id);

alter table public.files enable row level security;

drop policy if exists files_select on public.files;
create policy files_select on public.files for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

drop policy if exists files_insert on public.files;
create policy files_insert on public.files for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'doctor', 'receptionist'))
  );

drop policy if exists files_delete on public.files;
create policy files_delete on public.files for delete to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );

-- -----------------------------------------------------------------------------
-- appointments — المواعيد (مبسّط)
-- إدارة: clinic_admin + receptionist؛ عرض: كل أفراد العيادة
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  doctor_id    uuid references public.doctors(id) on delete set null,
  scheduled_at timestamptz not null,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes        text,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_appointments_clinic_id  on public.appointments(clinic_id);
create index if not exists idx_appointments_patient_id on public.appointments(patient_id);

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'receptionist'))
  );

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments for update to authenticated
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

-- =============================================================================
-- Storage: bucket خاص لملفات المرضى + سياسات عزل بين العيادات حسب المسار
-- المسار: {clinic_id}/{patient_id}/{uuid-filename}
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

-- عزل: أول مجلد في المسار يجب أن يساوي عيادة المستخدم (أو super_admin)
drop policy if exists patient_files_select on storage.objects;
create policy patient_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      private.is_super_admin()
      or (storage.foldername(name))[1] = private.current_clinic_id()::text
    )
  );

drop policy if exists patient_files_insert on storage.objects;
create policy patient_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and (
      private.is_super_admin()
      or (storage.foldername(name))[1] = private.current_clinic_id()::text
    )
  );

drop policy if exists patient_files_delete on storage.objects;
create policy patient_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      private.is_super_admin()
      or (storage.foldername(name))[1] = private.current_clinic_id()::text
    )
  );
