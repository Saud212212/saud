-- ════════════════════════════════════════════════════════════
--  EngHub Pro — Supabase database schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════

-- ─── PROFILES (1:1 with auth.users) ───────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  full_name    text,
  discipline   text,                 -- civil, mech, elec...
  license_no   text,
  organization text,
  country      text default 'SA',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── SUBSCRIPTIONS (Stripe-backed) ────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null default 'free',  -- free|trialing|active|past_due|canceled
  tier                   text not null default 'free',  -- free|pro|team|enterprise
  current_period_end     timestamptz,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique (user_id)
);

-- ─── PROJECTS ─────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  code        text,
  location    text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── CALCULATIONS ─────────────────────────────────────────────
create table if not exists public.calculations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  calc_id       text not null,        -- e.g. 's_steelBeam'
  title         text,
  inputs        jsonb default '{}'::jsonb,
  results       jsonb default '[]'::jsonb,
  ref           text,
  created_at    timestamptz default now()
);

-- ─── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_projects_user on public.projects(user_id, updated_at desc);
create index if not exists idx_calcs_project on public.calculations(project_id, created_at);
create index if not exists idx_subs_user on public.subscriptions(user_id);

-- ════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY — each user sees only their own data
-- ════════════════════════════════════════════════════════════
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.projects      enable row level security;
alter table public.calculations  enable row level security;

-- Profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Subscriptions (read-only for user; writes done by service role in webhook)
drop policy if exists "read own sub" on public.subscriptions;
create policy "read own sub" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Projects
drop policy if exists "own projects" on public.projects;
create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Calculations
drop policy if exists "own calcs" on public.calculations;
create policy "own calcs" on public.calculations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
--  AUTO-CREATE profile + free subscription on signup
-- ════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
    on conflict (id) do nothing;
  insert into public.subscriptions (user_id, status, tier)
    values (new.id, 'free', 'free')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
