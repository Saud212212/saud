-- =============================================================================
-- جعل file_number مُدارًا من الخادم بالكامل:
--   * إضافة DEFAULT (ليصبح اختيارياً في أنواع TypeScript المولّدة)
--   * الـ trigger يحسب الرقم دائماً عند الإدراج (يتجاهل أي قيمة يرسلها العميل)
-- =============================================================================
alter table public.patients alter column file_number set default 0;

create or replace function public.set_patient_file_number()
returns trigger language plpgsql set search_path = public as $$
begin
  -- قفل على مستوى المعاملة لكل عيادة لمنع تكرار الأرقام عند الإدراج المتزامن
  perform pg_advisory_xact_lock(hashtext(new.clinic_id::text));
  select coalesce(max(file_number), 0) + 1
    into new.file_number
    from public.patients
   where clinic_id = new.clinic_id;
  return new;
end;
$$;
