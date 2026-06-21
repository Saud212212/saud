"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { assertClinicCanWrite } from "@/lib/subscription";
import { canManagePatients } from "@/types/rbac";
import {
  invoiceSchema,
  paymentSchema,
  computeInvoiceTotal,
} from "@/lib/validation/invoices";
import type { Json } from "@/types/database.types";

/** يحلّل بنود الفاتورة القادمة كنص JSON. */
function parseItemsJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** إنشاء فاتورة جديدة (المبلغ يُحسب من البنود على الخادم). */
export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManagePatients(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية إنشاء فاتورة.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  const parsed = invoiceSchema.safeParse({
    patient_id: formData.get("patient_id"),
    items: parseItemsJson(formData.get("items")),
  });
  if (!parsed.success) {
    return actionError("تحقق من بيانات الفاتورة.", z_flatten(parsed.error));
  }

  const amount = computeInvoiceTotal(parsed.data.items);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .insert({
        clinic_id: user.clinicId,
        patient_id: parsed.data.patient_id,
        items: parsed.data.items as unknown as Json,
        amount,
        created_by: user.id,
      })
      .select("id, invoice_number")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر إنشاء الفاتورة.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "invoice",
      entityId: data.id,
      metadata: { invoice_number: data.invoice_number, amount },
    });

    revalidatePath("/invoices");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء إنشاء الفاتورة.");
  }
}

/** تعديل بنود فاتورة (يعيد حساب المبلغ). */
export async function updateInvoice(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManagePatients(user.role)) {
    return actionError("ليست لديك صلاحية تعديل الفاتورة.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  const parsed = invoiceSchema.safeParse({
    patient_id: formData.get("patient_id"),
    items: parseItemsJson(formData.get("items")),
  });
  if (!parsed.success) {
    return actionError("تحقق من بيانات الفاتورة.", z_flatten(parsed.error));
  }

  const amount = computeInvoiceTotal(parsed.data.items);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .update({
        patient_id: parsed.data.patient_id,
        items: parsed.data.items as unknown as Json,
        amount,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر تعديل الفاتورة.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "update",
      entityType: "invoice",
      entityId: id,
      metadata: { amount },
    });

    revalidatePath("/invoices");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء التعديل.");
  }
}

/** تسجيل دفعة يدوية (نقدي/بطاقة). الـ trigger يحدّث حالة الفاتورة. */
export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManagePatients(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية تسجيل دفعة.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  const parsed = paymentSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    amount: formData.get("amount"),
    method: formData.get("method"),
  });
  if (!parsed.success) {
    return actionError("تحقق من بيانات الدفعة.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .insert({
        clinic_id: user.clinicId,
        invoice_id: parsed.data.invoice_id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر تسجيل الدفعة.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "payment",
      entityId: data.id,
      metadata: { invoice_id: parsed.data.invoice_id, amount: parsed.data.amount, method: parsed.data.method },
    });

    revalidatePath("/invoices");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء تسجيل الدفعة.");
  }
}

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** إنشاء جلسة Stripe Checkout لدفع رصيد الفاتورة المتبقّي أونلاين. */
export async function createInvoiceCheckout(
  invoiceId: string,
): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "غير مصرّح." };
  if (!canManagePatients(user.role) || !user.clinicId) {
    return { ok: false, error: "ليست لديك صلاحية." };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "تكامل Stripe غير مُعدّ على الخادم." };
  }

  try {
    const supabase = await createClient();
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, clinic_id, payments(amount)")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      return { ok: false, error: "الفاتورة غير موجودة." };
    }

    const paid = (invoice.payments ?? []).reduce(
      (s: number, p: { amount: number }) => s + Number(p.amount),
      0,
    );
    const remaining = Math.round((Number(invoice.amount) - paid) * 100) / 100;
    if (remaining <= 0) {
      return { ok: false, error: "الفاتورة مدفوعة بالكامل." };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: invoice.currency,
            product_data: { name: `فاتورة رقم ${invoice.invoice_number}` },
            unit_amount: Math.round(remaining * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/invoices?paid=1`,
      cancel_url: `${appUrl}/invoices?canceled=1`,
      metadata: {
        type: "invoice",
        invoice_id: invoice.id,
        clinic_id: invoice.clinic_id,
      },
    });

    if (!session.url) {
      return { ok: false, error: "تعذّر إنشاء جلسة الدفع." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقع.",
    };
  }
}

function z_flatten(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
