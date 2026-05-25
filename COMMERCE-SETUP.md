# 🚀 دليل الإطلاق التجاري — EngHub Pro

تحويل الموقع من "أدوات مجانية" إلى **منصة تستقبل اشتراكات حقيقية**.
الوقت المتوقع: **2-4 ساعات** عمل تقني + وقت التسجيل التجاري.

التكلفة للبدء: **$0** (Supabase + Stripe مجانيان حتى أول إيرادات).

---

## 📐 المعمارية

```
المتصفح (GitHub Pages)
  │  config.js (مفاتيح عامة فقط)
  │  commerce.js  ──► تسجيل دخول / مزامنة
  ▼
Supabase (مجاني)
  ├── Auth (تسجيل/دخول)
  ├── Postgres (profiles, subscriptions, projects, calculations)
  └── Edge Functions:
        ├── create-checkout  ──► Stripe (المفتاح السري هنا فقط)
        └── stripe-webhook   ◄── Stripe (تحديث حالة الاشتراك)
```

**القاعدة الذهبية:** المفتاح السري لـ Stripe و service-role لـ Supabase **لا يظهران أبداً** في المتصفح — فقط في أسرار Edge Functions.

---

## ① إعداد Supabase (30 دقيقة)

1. أنشئ حساباً على [supabase.com](https://supabase.com) → **New Project**
2. **SQL Editor → New Query** → الصق محتوى `supabase/schema.sql` → **Run**
   (ينشئ الجداول + RLS + التريغر التلقائي عند التسجيل)
3. **Authentication → Providers → Email**: فعّله. (اختياري: فعّل Google)
4. **Project Settings → API**: انسخ:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`

---

## ② إعداد Stripe (30 دقيقة)

1. أنشئ حساباً على [stripe.com](https://stripe.com)
2. **Products** → أنشئ 3 منتجات باشتراك شهري:
   - محترف $29/شهر → انسخ `price_xxx` → `PRICES.pro`
   - فريق $99/شهر → `PRICES.team`
   - مؤسسي $499/شهر → `PRICES.enterprise`
3. **Developers → API keys**: انسخ `Publishable key` → `STRIPE_PUBLISHABLE_KEY`
   (الـ `Secret key` للخطوة ④ فقط — لا تضعه في config.js)

---

## ③ تعبئة config.js (5 دقائق)

```bash
cp config.example.js config.js
```
عبّئ القيم العامة (الـ URL، anon key، publishable key، الـ Price IDs)، ثم:
```bash
git add config.js && git commit -m "add commerce config" && git push
```
> ملاحظة: هذه المفاتيح **عامة وآمنة** للنشر. لا تضع مفاتيح سرية هنا.

---

## ④ نشر Edge Functions (45 دقيقة)

ثبّت Supabase CLI:
```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

اضبط الأسرار (السرية — على الخادم فقط):
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx   # من الخطوة التالية
supabase secrets set FRONTEND_URL=https://saud212212.github.io/saud
supabase secrets set PRICE_PRO=price_xxx
supabase secrets set PRICE_TEAM=price_xxx
supabase secrets set PRICE_ENT=price_xxx
```

انشر الدالتين:
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```

---

## ⑤ ربط Stripe Webhook (15 دقيقة)

1. **Stripe → Developers → Webhooks → Add endpoint**
2. الرابط: `https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook`
3. الأحداث:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. انسخ **Signing secret** (`whsec_xxx`) وضعه في:
   `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`

---

## ⑥ الاختبار (Test Mode)

1. استخدم مفاتيح `pk_test_` / `sk_test_` أولاً
2. افتح الموقع → "حسابي" → أنشئ حساباً → أكّد البريد
3. اذهب للباقات → "اشترك" → بطاقة اختبار Stripe: `4242 4242 4242 4242`
4. تحقق أن الاشتراك ظهر "نشط" في الموقع وفي جدول `subscriptions`

عند النجاح، بدّل لمفاتيح `live` وأعد نشر الأسرار.

---

## ⑦ المتطلبات القانونية والتجارية (موازية)

| المتطلب | لماذا | الجهة |
|---------|------|------|
| **سجل تجاري** | لفتح حساب Stripe/بنكي | وزارة التجارة (السعودية) |
| **حساب بنكي تجاري** | استلام الأموال | أي بنك |
| **تفعيل Stripe** | KYC + ربط البنك | Stripe Dashboard |
| **ZATCA — الفوترة الإلكترونية** | إلزامي بالسعودية | [zatca.gov.sa](https://zatca.gov.sa) |
| **سياسة الخصوصية + الشروط** | قانوني + شرط Stripe | اكتبها أو استخدم مولّداً |
| **سياسة الاسترداد** | شرط Stripe للاشتراكات | — |

> Stripe لا يدعم السعودية مباشرة في كل الحالات — تحقق من التوفر، أو استخدم **Tap Payments** / **Moyasar** / **PayTabs** (بوابات خليجية، نفس الفكرة: Edge Function تنشئ جلسة دفع).

---

## ⑧ الإطلاق

- بدّل لمفاتيح Stripe **Live**
- فعّل GitHub Pages (إن لم يكن مفعّلاً)
- راقب أول 24 ساعة عبر Stripe Dashboard + Supabase Logs

---

## ملاحظات مهمة

- **الوضع المجاني يبقى يعمل:** بدون `config.js` الموقع يشتغل local-only (كل الأدوات مجانية، بياناتها محلية). إضافة `config.js` تفعّل الحسابات والدفع تلقائياً.
- **GitHub Pages ساكن:** لا يشغّل Backend — لذلك نستخدم Supabase Edge Functions للجزء الخادمي. لا حاجة لخادم خاص.
- **الأمان:** RLS مفعّل — كل مستخدم يرى بياناته فقط. تحديث الاشتراكات يتم عبر service-role في الـ webhook فقط.
