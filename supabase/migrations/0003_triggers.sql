-- ============================================================================
-- ClinicOS — 0003 Triggers & automation
--   * updated_at maintenance
--   * auto file_number / invoice_number per clinic
--   * audit logging of CREATE / UPDATE / DELETE
--   * auth.users -> public.users provisioning
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clinics','users','patients','doctors','appointments','medical_records',
    'prescriptions','invoices','subscriptions'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Sequential, clinic-scoped file_number  ->  CLINIC-0001
-- ----------------------------------------------------------------------------
create or replace function public.gen_file_number()
returns trigger language plpgsql as $$
declare next_seq integer;
begin
  if new.file_number is not null and new.file_number <> '' then
    return new;
  end if;
  select coalesce(max(
           nullif(regexp_replace(file_number, '\D', '', 'g'), '')::int), 0) + 1
    into next_seq
    from public.patients
   where clinic_id = new.clinic_id;
  new.file_number := 'CLINIC-' || lpad(next_seq::text, 4, '0');
  return new;
end;
$$;

create trigger trg_patients_file_number
  before insert on public.patients
  for each row execute function public.gen_file_number();

-- ----------------------------------------------------------------------------
-- Sequential, clinic-scoped invoice_number  ->  INV-000001
-- ----------------------------------------------------------------------------
create or replace function public.gen_invoice_number()
returns trigger language plpgsql as $$
declare next_seq integer;
begin
  if new.invoice_number is not null and new.invoice_number <> '' then
    return new;
  end if;
  select coalesce(max(
           nullif(regexp_replace(invoice_number, '\D', '', 'g'), '')::int), 0) + 1
    into next_seq
    from public.invoices
   where clinic_id = new.clinic_id;
  new.invoice_number := 'INV-' || lpad(next_seq::text, 6, '0');
  return new;
end;
$$;

create trigger trg_invoices_invoice_number
  before insert on public.invoices
  for each row execute function public.gen_invoice_number();

-- ----------------------------------------------------------------------------
-- Keep invoice status in sync with amount_paid.
-- ----------------------------------------------------------------------------
create or replace function public.sync_invoice_status()
returns trigger language plpgsql as $$
begin
  if new.amount_paid <= 0 then
    new.status := 'unpaid';
  elsif new.amount_paid >= new.total_amount then
    new.status := 'paid';
  else
    new.status := 'partially_paid';
  end if;
  return new;
end;
$$;

create trigger trg_invoices_status
  before insert or update of amount_paid, total_amount on public.invoices
  for each row execute function public.sync_invoice_status();

-- ----------------------------------------------------------------------------
-- Audit logging. SECURITY DEFINER so inserts bypass audit_logs RLS.
-- ----------------------------------------------------------------------------
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_clinic_id uuid;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_clinic_id := (v_old ->> 'clinic_id')::uuid;
    v_entity_id := (v_old ->> 'id')::uuid;
  else
    v_new := to_jsonb(new);
    v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
    v_clinic_id := (v_new ->> 'clinic_id')::uuid;
    v_entity_id := (v_new ->> 'id')::uuid;
  end if;

  insert into public.audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_clinic_id,
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'patients','doctors','appointments','medical_records','prescriptions','invoices','payments'
  ] loop
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$s
         for each row execute function public.write_audit_log();', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Provision a public.users row when an auth user is created.
-- clinic_id / role are read from the sign-up metadata when present.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.users (id, email, full_name, clinic_id, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    (new.raw_user_meta_data ->> 'clinic_id')::uuid,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'receptionist')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
