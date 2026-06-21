import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planKeyFromPriceId } from "@/lib/stripe/plans";

/**
 * Stripe Webhook — يتحقق من التوقيع على الجسم الخام ثم يحدّث القاعدة
 * عبر Service Role (لا جلسة مستخدم في الويب هوك).
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe غير مُعدّ على الخادم." },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "توقيع مفقود." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    // التوقيع غير صالح → رفض
    return NextResponse.json(
      { error: `توقيع غير صالح: ${err instanceof Error ? err.message : "?"}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.type === "invoice" && session.payment_status === "paid") {
          await handleInvoicePaid(admin, session);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await handleSubscriptionChange(admin, event.data.object);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const clinicId = sub.metadata?.clinic_id;
        if (clinicId) {
          await admin
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("clinic_id", clinicId);
        }
        break;
      }
      default:
        // أحداث أخرى لا تهمّنا
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] خطأ في المعالجة:", err);
    return NextResponse.json({ error: "خطأ في المعالجة." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** يسجّل دفعة أونلاين للفاتورة (مع حماية من التكرار). */
async function handleInvoicePaid(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session,
) {
  const invoiceId = session.metadata?.invoice_id;
  const clinicId = session.metadata?.clinic_id;
  if (!invoiceId || !clinicId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;

  // منع التكرار عند إعادة إرسال الحدث
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("stripe_payment_id", paymentIntentId)
    .maybeSingle();
  if (existing) return;

  const amount = (session.amount_total ?? 0) / 100;
  if (amount <= 0) return;

  await admin.from("payments").insert({
    clinic_id: clinicId,
    invoice_id: invoiceId,
    amount,
    method: "online",
    stripe_payment_id: paymentIntentId,
  });
  // الـ trigger في القاعدة يحدّث حالة الفاتورة تلقائياً
}

/** يطابق حالات Stripe مع القيم المسموح بها في قيد قاعدة البيانات. */
function clampStatus(status: Stripe.Subscription.Status): string {
  const allowed = new Set([
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
    "unpaid",
  ]);
  if (allowed.has(status)) return status;
  if (status === "incomplete_expired") return "incomplete";
  if (status === "paused") return "past_due";
  return "canceled";
}

/** يحدّث اشتراك العيادة من حدث Stripe. */
async function handleSubscriptionChange(
  admin: ReturnType<typeof createAdminClient>,
  sub: Stripe.Subscription,
) {
  const clinicId = sub.metadata?.clinic_id;
  if (!clinicId) return;

  const priceId = sub.items.data[0]?.price.id;
  const plan =
    sub.metadata?.plan ?? (priceId ? planKeyFromPriceId(priceId) : null) ?? undefined;

  const periodEnd = sub.items.data[0]?.current_period_end;

  await admin
    .from("subscriptions")
    .update({
      status: clampStatus(sub.status),
      ...(plan ? { plan } : {}),
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("clinic_id", clinicId);
}
