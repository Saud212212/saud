"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Wallet, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceFormDialog, type PatientOption } from "./invoice-form-dialog";
import { PaymentDialog } from "./payment-dialog";
import { createInvoiceCheckout } from "./actions";

type Item = { description: string; quantity: number; unit_price: number };

type Props = {
  invoice: {
    id: string;
    patient_id: string;
    items: Item[];
    amount: number;
    paid: number;
    status: string;
  };
  patients: PatientOption[];
};

export function InvoiceRowActions({ invoice, patients }: Props) {
  const [isPending, startTransition] = useTransition();
  const remaining = Math.round((invoice.amount - invoice.paid) * 100) / 100;
  const settled = remaining <= 0;

  function payOnline() {
    startTransition(async () => {
      const result = await createInvoiceCheckout(invoice.id);
      if (result.ok) {
        window.location.href = result.url;
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <InvoiceFormDialog
        mode="edit"
        patients={patients}
        invoice={{ id: invoice.id, patient_id: invoice.patient_id, items: invoice.items }}
        trigger={
          <Button variant="ghost" size="icon" aria-label="تعديل">
            <Pencil className="size-4" />
          </Button>
        }
      />
      {!settled && (
        <>
          <PaymentDialog
            invoiceId={invoice.id}
            remaining={remaining}
            trigger={
              <Button variant="ghost" size="icon" aria-label="تسجيل دفعة">
                <Wallet className="size-4" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={payOnline}
            disabled={isPending}
            aria-label="دفع أونلاين"
          >
            <CreditCard className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}
