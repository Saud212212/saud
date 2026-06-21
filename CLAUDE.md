# ClinicOS — دليل المشروع والقوانين (يُقرأ في كل جلسة)

نظام **ClinicOS**: نظام إدارة عيادات SaaS متعدد العملاء (Multi-Tenant) بنظام الاشتراكات.
الكود في مجلد `clinicos/`. لكل جلسة عمل: التزم بالقوانين أدناه حرفياً.

> ⚠️ **Next.js 16**: فيه تغييرات جذرية عن الإصدارات السابقة. قبل كتابة أي كود يخص
> التوجيه/الجلسات راجع `clinicos/node_modules/next/dist/docs/`. أبرز تغيير اعتمدناه:
> **`middleware.ts` أصبح `proxy.ts`**، و `cookies()` صارت `async`.

## التقنيات (لا تُغيَّر)
- **Frontend:** Next.js 16 (App Router) + TypeScript (strict) + Tailwind CSS v4 + Shadcn UI
- **Backend + DB:** Supabase (PostgreSQL) — project ref: `iwtuqvglmoazaigckntj` (eu-central-1)
- **Auth:** Supabase Auth | **Storage:** Supabase Storage | **Payments:** Stripe | **Deploy:** Vercel
- الواجهة عربية بالكامل (RTL) بخط Cairo.

## القوانين المعمارية غير القابلة للتفاوض
1. **العزل:** كل جدول مرتبط بعيادة يحتوي عمود `clinic_id`.
2. **الأمان:** RLS مُفعّلة على كل جدول، مع سياسة تمنع الوصول لغير بيانات العيادة الحالية
   (`clinic_id = private.current_clinic_id()`).
3. **ممنوع منعاً باتاً** أي استعلام يتجاوز RLS أو يصل لبيانات عيادة أخرى.
4. **RBAC** بأربعة أدوار: `super_admin`, `clinic_admin`, `doctor`, `receptionist`.
   `super_admin` فقط يرى كل العيادات.
5. كل عملية حساسة (إنشاء/تعديل/حذف) تُسجَّل في `audit_logs` (يُضاف في مرحلة لاحقة).
6. المفاتيح السرّية (Stripe Secret، Supabase Service Role) **خادمية فقط**، لا تُكشف في الواجهة.
   - عام (يجوز كشفه): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - سرّي (خادمي فقط): `SUPABASE_SERVICE_ROLE_KEY` (عبر `src/lib/supabase/admin.ts` المحميّ بـ `server-only`)

## معايير الجودة
- TypeScript صارم، بلا `any` إلا للضرورة القصوى.
- التحقق من المدخلات (validation) **على الخادم** (Zod) وليس الواجهة فقط.
- معالجة الأخطاء في كل استدعاء لقاعدة البيانات.
- كود نظيف منظَّم في مجلدات واضحة، مع تعليقات عند المنطق المعقّد.

## نمط العمل (مهم)
- نعمل على **مراحل مرقّمة، مرحلة واحدة في كل مرة**.
- بعد كل مرحلة: توقّف، لخّص، واكتب اختباراً يثبت أنها تعمل.
- لا تنتقل لمرحلة جديدة إلا بموافقة صريحة من المالك.

## بنية المشروع (clinicos/)
```
src/
  app/
    (auth)/login/            # صفحة تسجيل الدخول + Server Action
    (dashboard)/             # لوحات محمية (layout يفرض الجلسة + تسجيل خروج)
      admin/ dashboard/ doctor/ reception/
    layout.tsx  page.tsx     # الجذر: توجيه حسب الدور / لتسجيل الدخول
  components/ui/             # مكوّنات Shadcn
  lib/
    supabase/                # client.ts (متصفح) / server.ts (خادم) / admin.ts (service role) / proxy.ts
    auth/session.ts          # getCurrentUser / requireUser / requireRole
    validation/              # مخططات Zod
  types/                     # database.types.ts (مولَّد) + rbac.ts
  proxy.ts                   # بديل middleware (Next 16)
supabase/
  migrations/                # 0001-0002 الأساس، 0003-0004 المرضى/الأطباء/التدقيق
  tests/                     # اختبارات عزل RLS (SQL)
```

## قاعدة البيانات
- **المرحلة 1:** `roles` (مرجعي عام)، `clinics`، `users` (مرتبط بـ `auth.users`)، `subscriptions`.
- **المرحلة 2:** `audit_logs` (append-only)، `patients`، `doctors` (مع `user_id` اختياري لربط حساب دخول لاحقاً).
- دوال مساعدة لـ RLS في مخطط `private` غير المكشوف عبر REST (لتجنّب التكرار وتفادي تحذيرات الأمان):
  `private.current_clinic_id()`, `private.current_user_role()`, `private.is_super_admin()`.
- Trigger `on_auth_user_created` يُنشئ صف `public.users` تلقائياً من `raw_user_meta_data`.
- `patients.file_number` مُدار من الخادم: trigger يحسبه متسلسلاً لكل عيادة (مع advisory lock).
- صلاحيات حسب الدور مفروضة في RLS: المرضى (clinic_admin + receptionist كتابة، doctor عرض)؛ الأطباء (clinic_admin كتابة).
- التدقيق: استدعِ `logAudit()` من `lib/audit.ts` بعد كل عملية كتابة/تعديل/حذف.
- بعد أي تعديل DDL: شغّل مدقّق الأمان (`get_advisors security`) ويجب أن يكون نظيفاً.

## الاختبارات
- وحدات منطق RBAC: `npm test` (داخل `clinicos/`).
- عزل RLS: `supabase/tests/rls_isolation.sql` (يُشغَّل عبر psql، ينتهي بـ rollback).
