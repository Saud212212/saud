"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { recordPayment } from "./actions";

type Props = {
  invoiceId: string;
  remaining: number;
  trigger: React.ReactNode;
};

export function PaymentDialog({ invoiceId, remaining, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("invoice_id", invoiceId);
    setErrors({});

    startTransition(async () => {
      const result = await recordPayment(formData);
      if (result.ok) {
        toast.success("تم تسجيل الدفعة.");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسجيل دفعة</DialogTitle>
          <DialogDescription>
            المتبقّي على الفاتورة: {remaining.toFixed(2)} ر.س
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label>المبلغ</Label>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min={0.01}
              defaultValue={remaining > 0 ? remaining : ""}
              required
            />
            {errors.amount && (
              <p className="text-destructive text-xs">{errors.amount[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>طريقة الدفع</Label>
            <Select name="method" defaultValue="cash">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدي</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ التسجيل…" : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
