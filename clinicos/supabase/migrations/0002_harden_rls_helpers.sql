-- =============================================================================
-- ClinicOS — تحصين دوال RLS المساعدة
-- نقل الدوال المساعدة إلى مخطط private غير المكشوف عبر REST API،
-- وذلك لمنع استدعائها مباشرةً عبر /rest/v1/rpc وإسكات تحذيرات المدقّق الأمني.
-- كما نضبط search_path لدالة set_updated_at.
-- =============================================================================

-- 1) مخطط خاص غير مكشوف عبر PostgREST
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- 2) إعادة إنشاء الدوال المساعدة داخل private
create or replace function private.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.users where id = auth.uid();
$$;

create or replace function private.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select r.name from public.users u join public.roles r on r.id = u.role_id where u.id = auth.uid();
$$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.current_user_role() = 'super_admin', false);
$$;

-- منح التنفيذ للمصادَقين والخادم فقط (لا anon)
revoke all on function private.current_clinic_id() from public;
revoke all on function private.current_user_role() from public;
revoke all on function private.is_super_admin() from public;
grant execute on function private.current_clinic_id() to authenticated, service_role;
grant execute on function private.current_user_role() to authenticated, service_role;
grant execute on function private.is_super_admin() to authenticated, service_role;

-- 3) إعادة بناء السياسات لتشير إلى private.*
-- roles
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

-- clinics
drop policy if exists clinics_select on public.clinics;
create policy clinics_select on public.clinics for select to authenticated
  using (private.is_super_admin() or id = private.current_clinic_id());
drop policy if exists clinics_insert on public.clinics;
create policy clinics_insert on public.clinics for insert to authenticated
  with check (private.is_super_admin());
drop policy if exists clinics_update on public.clinics;
create policy clinics_update on public.clinics for update to authenticated
  using (private.is_super_admin() or (id = private.current_clinic_id() and private.current_user_role() = 'clinic_admin'))
  with check (private.is_super_admin() or (id = private.current_clinic_id() and private.current_user_role() = 'clinic_admin'));
drop policy if exists clinics_delete on public.clinics;
create policy clinics_delete on public.clinics for delete to authenticated
  using (private.is_super_admin());

-- users
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id() or id = auth.uid());
drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert to authenticated
  with check (private.is_super_admin() or (clinic_id = private.current_clinic_id() and private.current_user_role() = 'clinic_admin'));
drop policy if exists users_update on public.users;
create policy users_update on public.users for update to authenticated
  using (private.is_super_admin() or (clinic_id = private.current_clinic_id() and private.current_user_role() = 'clinic_admin') or id = auth.uid())
  with check (private.is_super_admin() or (clinic_id = private.current_clinic_id() and private.current_user_role() = 'clinic_admin') or id = auth.uid());
drop policy if exists users_delete on public.users;
create policy users_delete on public.users for delete to authenticated
  using (private.is_super_admin() or (clinic_id = private.current_clinic_id() and private.current_user_role() = 'clinic_admin'));

-- subscriptions
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.is_super_admin() or clinic_id = private.current_clinic_id());
drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

-- 4) إسقاط الدوال القديمة في public بعد فك ارتباط السياسات بها
drop function if exists public.current_clinic_id();
drop function if exists public.current_user_role();
drop function if exists public.is_super_admin();

-- 5) ضبط search_path لدالة set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

-- 6) منع استدعاء دالة الـ trigger عبر REST API (تُستدعى من الـ trigger فقط)
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
