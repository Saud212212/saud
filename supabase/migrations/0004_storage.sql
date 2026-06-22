-- ============================================================================
-- ClinicOS — 0004 Storage buckets
-- Files are namespaced by clinic:  <bucket>/<clinic_id>/...
-- Access is scoped so a user only touches objects under their own clinic_id.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('patient-files', 'patient-files', false),
  ('clinic-logos',  'clinic-logos',  true)
on conflict (id) do nothing;

-- Helper: first path segment is the clinic_id.
create or replace function public.storage_clinic_id(object_name text)
returns uuid language sql immutable as $$
  select nullif((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

-- patient-files: read/write only within the caller's clinic.
create policy patient_files_read on storage.objects for select
  using (
    bucket_id = 'patient-files'
    and public.same_clinic(public.storage_clinic_id(name))
  );

create policy patient_files_write on storage.objects for insert
  with check (
    bucket_id = 'patient-files'
    and public.storage_clinic_id(name) = public.auth_clinic_id()
  );

create policy patient_files_delete on storage.objects for delete
  using (
    bucket_id = 'patient-files'
    and public.storage_clinic_id(name) = public.auth_clinic_id()
  );

-- clinic-logos: public read, clinic-scoped write.
create policy clinic_logos_read on storage.objects for select
  using (bucket_id = 'clinic-logos');

create policy clinic_logos_write on storage.objects for insert
  with check (
    bucket_id = 'clinic-logos'
    and public.storage_clinic_id(name) = public.auth_clinic_id()
  );
