-- =============================================================================
-- ClinicOS — المرحلة 1: مخطط جداول الأساس (Base Schema)
-- الجداول: roles, clinics, subscriptions, users
-- القوانين المطبّقة:
--   * عمود clinic_id للعزل في كل جدول مرتبط بعيادة
--   * تفعيل Row Level Security (RLS) على كل جدول
--   * سياسات عزل: لا يصل المستخدم إلا لبيانات عيادته (إلا super_admin)
--   * RBAC بأربعة أدوار عبر جدول roles
-- =============================================================================

-- إضافة الامتدادات اللازمة (uuid)
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) جدول الأدوار (roles) — جدول مرجعي عام (بدون clinic_id)
--    يحوي الأدوار الأربعة الثابتة لنظام RBAC.
-- -----------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique
              check (name in ('super_admin', 'clinic_admin', 'doctor', 'receptionist')),
  description text,
  created_at  timestamptz not null default now()
);

comment on table public.roles is 'الأدوار المرجعية لنظام RBAC. جدول عام لا يحمل clinic_id.';

-- زرع الأدوار الأربعة
insert into public.roles (name, description) values
  ('super_admin',   'مدير المنصّة — يرى كل العيادات ويديرها'),
  ('clinic_admin',  'مدير العيادة — يدير بيانات عيادته فقط'),
  ('doctor',        'طبيب — يصل لبيانات عيادته ضمن صلاحياته'),
  ('receptionist',  'موظف استقبال — يدير المواعيد والاستقبال في عيادته')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 2) جدول العيادات (clinics) — الجدول الجذر للعزل متعدد العملاء
-- -----------------------------------------------------------------------------
create table if not exists public.clinics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.clinics is 'العيادات (المستأجرون/Tenants). الجدول الجذر لعزل البيانات.';

-- -----------------------------------------------------------------------------
-- 3) جدول المستخدمين (users) — يعكس auth.users ويربط الدور والعيادة
--    clinic_id قد يكون NULL فقط لمستخدم super_admin (لا ينتمي لعيادة).
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  clinic_id   uuid references public.clinics(id) on delete cascade,
  role_id     uuid not null references public.roles(id),
  email       text not null,
  full_name   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
  -- ملاحظة: قاعدة "كل مستخدم غير super_admin يجب أن ينتمي لعيادة" تُفرض عبر
  -- Trigger أدناه (enforce_user_clinic_rule) لأن قيود CHECK لا تقبل الاستعلامات الفرعية.
);

create index if not exists idx_users_clinic_id on public.users(clinic_id);
create index if not exists idx_users_role_id   on public.users(role_id);

comment on table public.users is 'ملف المستخدم المرتبط بـ auth.users، يحمل clinic_id و role_id.';

-- -----------------------------------------------------------------------------
-- 4) جدول الاشتراكات (subscriptions) — اشتراك واحد لكل عيادة
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null unique references public.clinics(id) on delete cascade,
  status                 text not null default 'trialing'
                         check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid')),
  plan                   text not null default 'free',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_subscriptions_clinic_id on public.subscriptions(clinic_id);

comment on table public.subscriptions is 'اشتراك العيادة (Stripe). عمود clinic_id للعزل.';

-- =============================================================================
-- دوال مساعدة (SECURITY DEFINER) لتجنّب التكرار اللانهائي في سياسات RLS.
-- تعمل بصلاحيات المالك فتتجاوز RLS عند القراءة من public.users.
-- =============================================================================

-- تُعيد معرّف عيادة المستخدم الحالي
create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from public.users where id = auth.uid();
$$;

-- تُعيد اسم دور المستخدم الحالي
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid();
$$;

-- هل المستخدم الحالي super_admin؟
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false);
$$;

-- =============================================================================
-- تفعيل RLS وسياسات العزل على كل جدول
-- =============================================================================

-- ---------- roles: جدول مرجعي عام، قراءة للجميع المصادَقين، كتابة super_admin فقط ----------
alter table public.roles enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (true);

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------- clinics: المستخدم يرى عيادته فقط، super_admin يرى الكل ----------
alter table public.clinics enable row level security;

drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics
  for select to authenticated
  using (public.is_super_admin() or id = public.current_clinic_id());

-- إنشاء العيادات: super_admin فقط
drop policy if exists clinics_insert on public.clinics;
create policy clinics_insert on public.clinics
  for insert to authenticated
  with check (public.is_super_admin());

-- تعديل العيادة: super_admin أو مدير العيادة لعيادته
drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics
  for update to authenticated
  using (
    public.is_super_admin()
    or (id = public.current_clinic_id() and public.current_user_role() = 'clinic_admin')
  )
  with check (
    public.is_super_admin()
    or (id = public.current_clinic_id() and public.current_user_role() = 'clinic_admin')
  );

-- حذف العيادة: super_admin فقط
drop policy if exists clinics_delete on public.clinics;
create policy clinics_delete on public.clinics
  for delete to authenticated
  using (public.is_super_admin());

-- ---------- users: المستخدم يرى مستخدمي عيادته، super_admin يرى الكل ----------
alter table public.users enable row level security;

drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (
    public.is_super_admin()
    or clinic_id = public.current_clinic_id()
    or id = auth.uid()
  );

-- إضافة مستخدم: super_admin أو مدير العيادة (ضمن عيادته فقط)
drop policy if exists users_insert on public.users;
create policy users_insert on public.users
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (clinic_id = public.current_clinic_id() and public.current_user_role() = 'clinic_admin')
  );

-- تعديل مستخدم: super_admin، أو مدير العيادة لعيادته، أو المستخدم لنفسه
drop policy if exists users_update on public.users;
create policy users_update on public.users
  for update to authenticated
  using (
    public.is_super_admin()
    or (clinic_id = public.current_clinic_id() and public.current_user_role() = 'clinic_admin')
    or id = auth.uid()
  )
  with check (
    public.is_super_admin()
    or (clinic_id = public.current_clinic_id() and public.current_user_role() = 'clinic_admin')
    or id = auth.uid()
  );

-- حذف مستخدم: super_admin أو مدير العيادة لعيادته
drop policy if exists users_delete on public.users;
create policy users_delete on public.users
  for delete to authenticated
  using (
    public.is_super_admin()
    or (clinic_id = public.current_clinic_id() and public.current_user_role() = 'clinic_admin')
  );

-- ---------- subscriptions: المستخدم يرى اشتراك عيادته، super_admin يرى الكل ----------
-- ملاحظة: الكتابة الفعلية تتم من الخادم عبر Service Role (يتجاوز RLS) من Stripe webhook.
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_super_admin() or clinic_id = public.current_clinic_id());

-- التعديل من الواجهة: super_admin فقط (البقية عبر الخادم)
drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =============================================================================
-- Trigger: إنشاء صف public.users تلقائياً عند تسجيل مستخدم جديد في auth.users
-- يقرأ clinic_id و role من raw_user_meta_data إن وُجدت (للمستخدمين المُنشأين إدارياً).
-- =============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_id   uuid;
  v_clinic_id uuid;
  v_role_name text;
begin
  -- استخراج اسم الدور من البيانات الوصفية، والافتراضي clinic_admin
  v_role_name := coalesce(new.raw_user_meta_data ->> 'role', 'clinic_admin');

  select id into v_role_id from public.roles where name = v_role_name;
  if v_role_id is null then
    select id into v_role_id from public.roles where name = 'clinic_admin';
  end if;

  -- استخراج معرّف العيادة إن وُجد
  if (new.raw_user_meta_data ->> 'clinic_id') is not null then
    v_clinic_id := (new.raw_user_meta_data ->> 'clinic_id')::uuid;
  end if;

  insert into public.users (id, email, full_name, role_id, clinic_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    v_role_id,
    v_clinic_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =============================================================================
-- Trigger: فرض قاعدة العزل — أي مستخدم غير super_admin يجب أن ينتمي لعيادة
-- =============================================================================
create or replace function public.enforce_user_clinic_rule()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role_name text;
begin
  select name into v_role_name from public.roles where id = new.role_id;
  if v_role_name <> 'super_admin' and new.clinic_id is null then
    raise exception 'المستخدم بدور % يجب أن ينتمي إلى عيادة (clinic_id مطلوب)', v_role_name;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_user_clinic_rule on public.users;
create trigger enforce_user_clinic_rule
  before insert or update on public.users
  for each row execute function public.enforce_user_clinic_rule();

-- =============================================================================
-- Trigger: تحديث عمود updated_at تلقائياً
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_clinics_updated_at on public.clinics;
create trigger set_clinics_updated_at before update on public.clinics
  for each row execute function public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
