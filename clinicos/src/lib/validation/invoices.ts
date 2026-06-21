import * as z from "zod";

/** بند فاتورة واحد. */
export const invoiceItemSchema = z.object({
  description: z
    .string({ error: "وصف البند مطلوب." })
    .trim()
    .min(1, { error: "وصف البند مطلوب." })
    .max(200),
  quantity: z.coerce
    .number({ error: "الكمية غير صالحة." })
    .int({ error: "الكمية يجب أن تكون رقماً صحيحاً." })
    .min(1, { error: "الكمية يجب أن تكون 1 على الأقل." }),
  unit_price: z.coerce
    .number({ error: "السعر غير صالح." })
    .min(0, { error: "السعر غير صالح." }),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

/** مخطط إنشاء/تعديل فاتورة. */
export const invoiceSchema = z.object({
  patient_id: z.uuid({ error: "يجب اختيار مريض." }),
  items: z
    .array(invoiceItemSchema)
    .min(1, { error: "أضف بنداً واحداً على الأقل." }),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/** يحسب إجمالي الفاتورة من بنودها (على الخادم). */
export function computeInvoiceTotal(items: InvoiceItem[]): number {
  const total = items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price,
    0,
  );
  // تقريب إلى منزلتين عشريتين
  return Math.round(total * 100) / 100;
}

/** مخطط تسجيل دفعة يدوية (نقدي/بطاقة). */
export const paymentSchema = z.object({
  invoice_id: z.uuid({ error: "فاتورة غير صالحة." }),
  amount: z.coerce
    .number({ error: "المبلغ غير صالح." })
    .positive({ error: "المبلغ يجب أن يكون أكبر من صفر." }),
  method: z.enum(["cash", "card"], { error: "طريقة الدفع غير صالحة." }),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
