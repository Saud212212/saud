-- =============================================================================
-- اختبار عزل التخزين وصلاحيات البيانات السريرية (المرحلة 5)
-- يثبت: عيادة (أ) لا يمكن لعيادة (ب) الوصول لملفها حتى لو عرفت المسار،
-- وأن موظف الاستقبال محجوب عن السجلات الطبية السريرية.
-- التشغيل:  psql "$DATABASE_URL" -f supabase/tests/medical_storage_rls.sql
-- النجاح:   يطبع 'PHASE-5 STORAGE ISOLATION + CLINICAL RLS PASSED'. ينتهي بـ rollback.
-- =============================================================================
begin;
insert into public.clinics (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'عيادة أ', 'clinic-a'),
  ('22222222-2222-2222-2222-222222222222', 'عيادة ب', 'clinic-b');
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'doctor-a@test.com', '{"role":"doctor","clinic_id":"11111111-1111-1111-1111-111111111111"}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'recep-a@test.com', '{"role":"receptionist","clinic_id":"11111111-1111-1111-1111-111111111111"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-b@test.com', '{"role":"clinic_admin","clinic_id":"22222222-2222-2222-2222-222222222222"}');
insert into public.patients (id, clinic_id, full_name) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'مريض أ');
insert into public.medical_records (clinic_id, patient_id, allergies) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'بنسلين');
insert into storage.objects (bucket_id, name) values
  ('patient-files', '11111111-1111-1111-1111-111111111111/33333333-3333-3333-3333-333333333333/xray.pdf');

set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.medical_records) <> 1 then
    raise exception 'FAIL: doctor must see clinic medical record';
  end if;
  if (select count(*) from storage.objects where bucket_id='patient-files') <> 1 then
    raise exception 'FAIL: doctor must access own clinic file';
  end if;
end $$;

reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.medical_records) <> 0 then
    raise exception 'FAIL: receptionist must NOT see clinical medical records';
  end if;
end $$;

reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
do $$ begin
  if exists (select 1 from storage.objects where name = '11111111-1111-1111-1111-111111111111/33333333-3333-3333-3333-333333333333/xray.pdf') then
    raise exception 'FAIL: clinic B accessed clinic A file (STORAGE ISOLATION BREACH!)';
  end if;
  if (select count(*) from public.medical_records) <> 0 then
    raise exception 'FAIL: clinic B must NOT see clinic A medical records';
  end if;
end $$;

reset role;
select 'PHASE-5 STORAGE ISOLATION + CLINICAL RLS PASSED' as result;
rollback;
