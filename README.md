# ClinicOS

A multi-tenant **clinic management SaaS** built with Next.js 16, TypeScript,
Tailwind CSS v4, Supabase (PostgreSQL + Auth + Storage) and Stripe (Test Mode).

> **Status: Phase 1 foundation + core scaffolding.** This is a working, buildable
> base — not the finished product described in the original spec. The database,
> security model and auth/RBAC are complete and real; feature modules are
> scaffolded on top. See [Roadmap](#roadmap) for what's done vs. remaining.

## What's implemented

### Database (complete)
All 13 tables from the spec live in [`supabase/migrations`](supabase/migrations):

- `0001_init_schema.sql` — enums, all tables, foreign keys, generated `age`
  column, clinic-scoped uniqueness, and indexes (including `clinic_id` on every
  tenant table).
- `0002_rls_policies.sql` — **strict multi-tenant Row Level Security**. Helper
  functions (`auth_clinic_id()`, `auth_role()`, `is_super_admin()`,
  `same_clinic()`, `auth_doctor_id()`) drive per-role policies:
  - **super_admin** — read/write across all clinics
  - **clinic_admin** — full CRUD within their `clinic_id`
  - **doctor** — read patients/appointments; CRUD their *own* medical records &
    prescriptions
  - **receptionist** — CRUD patients, appointments, invoices & payments
- `0003_triggers.sql` — `updated_at` maintenance, auto `file_number`
  (`CLINIC-0001`) and `invoice_number` (`INV-000001`), invoice status sync,
  **audit logging** of all writes, and `auth.users → public.users` provisioning.
- `0004_storage.sql` — `patient-files` (private) and `clinic-logos` (public)
  buckets with clinic-scoped object policies.

### Application
- **Auth** — email/password + Google OAuth via Supabase SSR; session refresh and
  route protection in [`src/middleware.ts`](src/middleware.ts).
- **RBAC** — capability matrix in [`src/lib/rbac.ts`](src/lib/rbac.ts) mirroring
  the RLS policies, a `usePermission(action, resource)` hook, and a server-side
  `requireUser(role)` guard.
- **Registration** — creates a clinic + first `clinic_admin` (server route using
  the service role), starting a 14-day trial.
- **Role dashboards** — `/admin` (super admin), `/dashboard` (clinic admin),
  `/doctor`, `/reception`, each with its own nav shell and live, RLS-scoped data.
- **Patients module** — fully working list + create (React Query + React Hook
  Form + Zod + Sonner) as the reference implementation for other modules.
- **Stripe** — subscription checkout (`/api/stripe/checkout`) and webhook handler
  (`/api/stripe/webhook`) covering checkout/subscription/invoice events.
- **UI** — Shadcn-style primitives, teal/blue design system, dark-mode tokens,
  and RTL-ready Arabic font wiring.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Shadcn-style UI · Supabase ·
Stripe · Zustand · TanStack Query · React Hook Form + Zod · Recharts · date-fns ·
Lucide.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Stripe keys
```

Apply the database migrations to your Supabase project (in order). Either paste
each file into the Supabase SQL editor, or use the CLI:

```bash
supabase db push        # with supabase/migrations linked to your project
```

Then run the app:

```bash
npm run dev
```

Create the first account at `/register` (becomes a `clinic_admin`). To create a
`super_admin`, set that user's `role` directly in the `public.users` table.

### Environment variables

See [`.env.example`](.env.example). Supabase URL + anon key are required for the
app to boot; the service-role key powers registration and the Stripe webhook;
Stripe keys + price IDs enable billing.

## Project structure

```
supabase/migrations/   SQL schema, RLS, triggers, storage
src/
  app/
    (auth)/            login & register
    admin/             super-admin dashboard
    dashboard/         clinic-admin dashboard (+ patients module)
    doctor/            doctor portal
    reception/         receptionist portal
    api/               auth/register, stripe/checkout, stripe/webhook
    auth/callback/     OAuth code exchange
  components/          ui primitives, layout shell, dashboard widgets
  hooks/               usePermission + auth store (Zustand)
  lib/                 supabase clients, stripe, rbac, auth guard, utils
  types/               database types
```

## Roadmap

Built (Phase 1 + core): schema, RLS, triggers, storage, auth, RBAC, role
dashboards, patients CRUD, Stripe checkout/webhook.

Remaining feature modules (scaffolded as "coming soon", data model ready):
appointments calendar (FullCalendar) · invoice builder & payments UI · medical
records & prescriptions · file upload gallery · analytics charts · notifications
center · audit log viewer · super-admin clinic management UI · Stripe Customer
Portal · 2FA · full Arabic translations.
