-- =============================================================================
-- اختبار عزل RLS — يثبت أن كل عيادة لا ترى إلا بياناتها (القانون المعماري #2 و #3)
-- يُشغّل داخل معاملة وينتهي بـ rollback فلا يُبقي أي بيانات.
-- التشغيل:  psql "$DATABASE_URL" -f supabase/tests/rls_isolation.sql
-- النجاح:   يطبع 'ALL RLS ISOLATION TESTS PASSED'؛ أي خرق يرفع استثناءً.
-- =============================================================================
begin;

insert into public.clinics (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'عيادة أ', 'clinic-a'),
  ('22222222-2222-2222-2222-222222222222', 'عيادة ب', 'clinic-b');

insert into public.subscriptions (clinic_id, status, plan) values
  ('11111111-1111-1111-1111-111111111111', 'active', 'pro'),
  ('22222222-2222-2222-2222-222222222222', 'trialing', 'free');

-- إنشاء مستخدمي auth (الـ trigger ينشئ صفوف public.users تلقائياً)
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin-a@test.com',
   '{"role":"clinic_admin","clinic_id":"11111111-1111-1111-1111-111111111111","full_name":"مدير أ"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-b@test.com',
   '{"role":"clinic_admin","clinic_id":"22222222-2222-2222-2222-222222222222","full_name":"مدير ب"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'super@test.com',
   '{"role":"super_admin","full_name":"مدير المنصة"}');

do $$ begin
  if (select count(*) from public.users) <> 3 then
    raise exception 'FAIL: trigger should have created 3 public.users rows';
  end if;
end $$;

-- ============ المستخدم أ: يرى عيادته فقط ============
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.clinics) <> 1 then
    raise exception 'FAIL: user A must see exactly 1 clinic, saw %', (select count(*) from public.clinics);
  end if;
  if exists (select 1 from public.clinics where slug = 'clinic-b') then
    raise exception 'FAIL: user A must NOT see clinic-b (isolation breach!)';
  end if;
  if (select count(*) from public.subscriptions) <> 1 then
    raise exception 'FAIL: user A must see only own subscription';
  end if;
  if (select count(*) from public.users) <> 1 then
    raise exception 'FAIL: user A must see only own clinic users, saw %', (select count(*) from public.users);
  end if;
end $$;

-- ============ المستخدم ب: يرى عيادته فقط ============
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
do $$ begin
  if exists (select 1 from public.clinics where slug = 'clinic-a') then
    raise exception 'FAIL: user B must NOT see clinic-a (isolation breach!)';
  end if;
  if not exists (select 1 from public.clinics where slug = 'clinic-b') then
    raise exception 'FAIL: user B must see clinic-b';
  end if;
end $$;

-- ============ super_admin: يرى كل العيادات ============
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
do $$ begin
  if (select count(*) from public.clinics) <> 2 then
    raise exception 'FAIL: super_admin must see all clinics, saw %', (select count(*) from public.clinics);
  end if;
  if (select count(*) from public.users) <> 3 then
    raise exception 'FAIL: super_admin must see all users, saw %', (select count(*) from public.users);
  end if;
end $$;

reset role;
select 'ALL RLS ISOLATION TESTS PASSED' as result;

rollback;
