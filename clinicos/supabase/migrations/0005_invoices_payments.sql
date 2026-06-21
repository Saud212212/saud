-- =============================================================================
-- ClinicOS — المرحلة 4: الفواتير والمدفوعات
-- الجداول: invoices, payments — مع clinic_id وRLS وصلاحيات حسب الدور.
-- حالة الفاتورة تُحدَّث تلقائياً عبر trigger عند تغيّر الدفعات (يشمل دفعات Stripe).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- invoices
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete restrict,
  invoice_number integer not null default 0,
  amount         numeric(12, 2) not null default 0 check (amount >= 0),
  currency       text not null default 'sar',
  status         text not null default 'unpaid'
                 check (status in ('unpaid', 'partially_paid', 'paid')),
  items          jsonb not null default '[]'::jsonb,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint invoices_clinic_number_unique unique (clinic_id, invoice_number)
);
create index if not exists idx_invoices_clinic_id  on public.invoices(clinic_id);
create index if not exists idx_invoices_status      on public.invoices(clinic_id, status);
create index if not exists idx_invoices_patient_id  on public.invoices(patient_id);

-- ترقيم الفواتير متسلسلاً لكل عيادة (مُدار من الخادم)
create or replace function public.set_invoice_number()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('invoice:' || new.clinic_id::text));
  select coalesce(max(invoice_number), 0) + 1
    into new.invoice_number
    from public.invoices
   where clinic_id = new.clinic_id;
  return new;
end;
$$;
drop trigger if exists set_invoice_number on public.invoices;
create trigger set_invoice_number before insert on public.invoices
  for each row execute function public.set_invoice_number();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'receptionist'))
  );

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update to authenticated
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

drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );

-- -----------------------------------------------------------------------------
-- payments
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references public.clinics(id) on delete cascade,
  invoice_id        uuid not null references public.invoices(id) on delete cascade,
  amount            numeric(12, 2) not null check (amount > 0),
  method            text not null check (method in ('cash', 'card', 'online')),
  stripe_payment_id text,
  created_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_payments_clinic_id  on public.payments(clinic_id);
create index if not exists idx_payments_invoice_id  on public.payments(invoice_id);

alter table public.payments enable row level security;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
  with check (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() in ('clinic_admin', 'receptionist'))
  );

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments for delete to authenticated
  using (
    private.is_super_admin()
    or (clinic_id = private.current_clinic_id()
        and private.current_user_role() = 'clinic_admin')
  );

-- -----------------------------------------------------------------------------
-- تحديث حالة الفاتورة تلقائياً عند تغيّر الدفعات (SECURITY DEFINER لتجاوز RLS)
-- يعمل أيضاً مع دفعات Stripe المُدرجة عبر Service Role من الويب هوك.
-- -----------------------------------------------------------------------------
create or replace function public.recompute_invoice_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_invoice_id uuid;
  v_paid       numeric;
  v_amount     numeric;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = v_invoice_id;
  select amount into v_amount from public.invoices where id = v_invoice_id;
  if v_amount is null then
    return null;
  end if;
  update public.invoices
     set status = case
       when v_paid <= 0 then 'unpaid'
       when v_paid < v_amount then 'partially_paid'
       else 'paid'
     end
   where id = v_invoice_id;
  return null;
end;
$$;
revoke all on function public.recompute_invoice_status() from public, anon, authenticated;

drop trigger if exists recompute_invoice_status on public.payments;
create trigger recompute_invoice_status
  after insert or update or delete on public.payments
  for each row execute function public.recompute_invoice_status();
