"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createInvoice, updateInvoice } from "./actions";

export type PatientOption = { id: string; label: string };

type Item = { description: string; quantity: number; unit_price: number };

type Props = {
  mode: "create" | "edit";
  patients: PatientOption[];
  invoice?: {
    id: string;
    patient_id: string;
    items: Item[];
  };
  trigger: React.ReactNode;
};

export function InvoiceFormDialog({ mode, patients, invoice, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(invoice?.patient_id ?? "");
  const [items, setItems] = useState<Item[]>(
    invoice?.items?.length
      ? invoice.items
      : [{ description: "", quantity: 1, unit_price: 0 }],
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const total = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  );

  function updateItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData();
    formData.set("patient_id", patientId);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createInvoice(formData)
          : await updateInvoice(invoice!.id, formData);
      if (result.ok) {
        toast.success(mode === "create" ? "تم إنشاء الفاتورة." : "تم حفظ التعديلات.");
        setOpen(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "إنشاء فاتورة" : "تعديل الفاتورة"}
          </DialogTitle>
          <DialogDescription>
            الإجمالي يُحسب تلقائياً من البنود.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label>المريض</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المريض" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.patient_id && (
              <p className="text-destructive text-xs">{errors.patient_id[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>البنود</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="size-4" />
                بند
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="الوصف"
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    placeholder="الكمية"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="سعر الوحدة"
                    value={it.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(i)}
                    aria-label="حذف البند"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.items && (
              <p className="text-destructive text-xs">{errors.items[0]}</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold">
            <span>الإجمالي</span>
            <span>{total.toFixed(2)} ر.س</span>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
