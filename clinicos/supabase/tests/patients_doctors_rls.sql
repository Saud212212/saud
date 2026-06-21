-- =============================================================================
-- اختبار عزل وصلاحيات المرضى والأطباء (المرحلة 2)
-- يثبت: عزل العيادات، توليد file_number لكل عيادة، وصلاحيات الأدوار.
-- التشغيل:  psql "$DATABASE_URL" -f supabase/tests/patients_doctors_rls.sql
-- النجاح:   يطبع 'ALL PHASE-2 RLS & PERMISSION TESTS PASSED'؛ أي خرق يرفع استثناءً.
-- ينتهي بـ rollback فلا يُبقي أي بيانات.
-- =============================================================================
begin;

insert into public.clinics (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'عيادة أ', 'clinic-a'),
  ('22222222-2222-2222-2222-222222222222', 'عيادة ب', 'clinic-b');

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin-a@test.com', '{"role":"clinic_admin","clinic_id":"11111111-1111-1111-1111-111111111111"}'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'recep-a@test.com', '{"role":"receptionist","clinic_id":"11111111-1111-1111-1111-111111111111"}'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'doctor-a@test.com', '{"role":"doctor","clinic_id":"11111111-1111-1111-1111-111111111111"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-b@test.com', '{"role":"clinic_admin","clinic_id":"22222222-2222-2222-2222-222222222222"}');

-- ========= توليد file_number التلقائي المتسلسل لكل عيادة =========
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
insert into public.patients (clinic_id, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'مريض أ-1'),
  ('11111111-1111-1111-1111-111111111111', 'مريض أ-2');
do $$ begin
  if (select array_agg(file_number order by file_number) from public.patients) <> array[1,2] then
    raise exception 'FAIL: file_number should auto-increment 1,2 per clinic, got %', (select array_agg(file_number) from public.patients);
  end if;
end $$;

reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
insert into public.patients (clinic_id, full_name) values ('22222222-2222-2222-2222-222222222222', 'مريض ب-1');
do $$ begin
  if (select file_number from public.patients where clinic_id='22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception 'FAIL: clinic B file_number should restart at 1';
  end if;
end $$;

-- ========= العزل: مستخدم عيادة أ لا يرى مرضى عيادة ب =========
reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.patients) <> 2 then
    raise exception 'FAIL: clinic A user must see only own 2 patients, saw %', (select count(*) from public.patients);
  end if;
  if exists (select 1 from public.patients where full_name = 'مريض ب-1') then
    raise exception 'FAIL: clinic A user must NOT see clinic B patient (ISOLATION BREACH!)';
  end if;
end $$;

-- ========= الصلاحيات: doctor عرض فقط =========
reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}';
do $$
declare v_updated int;
begin
  if (select count(*) from public.patients) <> 2 then
    raise exception 'FAIL: doctor must view clinic patients';
  end if;
  update public.patients set full_name = 'hacked' where clinic_id='11111111-1111-1111-1111-111111111111';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'FAIL: doctor must NOT be able to update patients, updated % rows', v_updated;
  end if;
end $$;

-- ========= الصلاحيات: receptionist لا يضيف طبيباً =========
reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
do $$ begin
  begin
    insert into public.doctors (clinic_id, full_name) values ('11111111-1111-1111-1111-111111111111', 'د. ممنوع');
    raise exception 'FAIL: receptionist must NOT be able to insert doctors';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- ========= clinic_admin يضيف طبيباً =========
reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
insert into public.doctors (clinic_id, full_name, specialty) values ('11111111-1111-1111-1111-111111111111', 'د. نور', 'باطنية');
do $$ begin
  if (select count(*) from public.doctors) <> 1 then
    raise exception 'FAIL: clinic_admin must be able to add doctor';
  end if;
end $$;

reset role;
select 'ALL PHASE-2 RLS & PERMISSION TESTS PASSED' as result;
rollback;
