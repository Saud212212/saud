-- =============================================================================
-- اختبار عزل وصلاحيات الفواتير والمدفوعات (المرحلة 4)
-- يثبت: العزل بين العيادات، الترقيم المتسلسل، والتحديث التلقائي لحالة الفاتورة.
-- التشغيل:  psql "$DATABASE_URL" -f supabase/tests/invoices_payments_rls.sql
-- النجاح:   يطبع 'INVOICES/PAYMENTS RLS + STATUS TRIGGER PASSED'. ينتهي بـ rollback.
-- =============================================================================
begin;
insert into public.clinics (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'عيادة أ', 'clinic-a'),
  ('22222222-2222-2222-2222-222222222222', 'عيادة ب', 'clinic-b');
insert into auth.users (id, email, raw_user_meta_data) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'recep-a@test.com', '{"role":"receptionist","clinic_id":"11111111-1111-1111-1111-111111111111"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-b@test.com', '{"role":"clinic_admin","clinic_id":"22222222-2222-2222-2222-222222222222"}');
insert into public.patients (id, clinic_id, full_name) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'مريض أ');

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}';
insert into public.invoices (clinic_id, patient_id, amount, items)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 300.00,
        '[{"description":"كشف","quantity":1,"unit_price":100},{"description":"تحاليل","quantity":2,"unit_price":100}]');

do $$ declare v_id uuid; v_num int; v_status text;
begin
  select id, invoice_number, status into v_id, v_num, v_status from public.invoices;
  if v_num <> 1 then raise exception 'FAIL: invoice_number should be 1, got %', v_num; end if;
  if v_status <> 'unpaid' then raise exception 'FAIL: new invoice should be unpaid, got %', v_status; end if;
  insert into public.payments (clinic_id, invoice_id, amount, method)
  values ('11111111-1111-1111-1111-111111111111', v_id, 100, 'cash');
  select status into v_status from public.invoices where id = v_id;
  if v_status <> 'partially_paid' then raise exception 'FAIL: expected partially_paid, got %', v_status; end if;
  insert into public.payments (clinic_id, invoice_id, amount, method)
  values ('11111111-1111-1111-1111-111111111111', v_id, 200, 'card');
  select status into v_status from public.invoices where id = v_id;
  if v_status <> 'paid' then raise exception 'FAIL: expected paid, got %', v_status; end if;
end $$;

reset role; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
do $$ begin
  if exists (select 1 from public.invoices) then
    raise exception 'FAIL: clinic B must NOT see clinic A invoices (ISOLATION BREACH!)';
  end if;
  if exists (select 1 from public.payments) then
    raise exception 'FAIL: clinic B must NOT see clinic A payments (ISOLATION BREACH!)';
  end if;
end $$;

reset role;
select 'INVOICES/PAYMENTS RLS + STATUS TRIGGER PASSED' as result;
rollback;
