"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPrescription } from "./actions";

type Med = { name: string; dose: string; frequency: string };

export function PrescriptionDialog({
  patientId,
  trigger,
}: {
  patientId: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState<Med[]>([{ name: "", dose: "", frequency: "" }]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function updateMed(i: number, patch: Partial<Med>) {
    setMeds((p) => p.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("patient_id", patientId);
    formData.set("medications", JSON.stringify(meds));
    setErrors({});
    startTransition(async () => {
      const result = await createPrescription(formData);
      if (result.ok) {
        toast.success("تم إنشاء الوصفة.");
        setOpen(false);
        setMeds([{ name: "", dose: "", frequency: "" }]);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>وصفة طبية جديدة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>الأدوية</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMeds((p) => [...p, { name: "", dose: "", frequency: "" }])}
              >
                <Plus className="size-4" />
                دواء
              </Button>
            </div>
            {meds.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="اسم الدواء"
                  value={m.name}
                  onChange={(e) => updateMed(i, { name: e.target.value })}
                />
                <Input
                  className="w-24"
                  placeholder="الجرعة"
                  value={m.dose}
                  onChange={(e) => updateMed(i, { dose: e.target.value })}
                />
                <Input
                  className="w-28"
                  placeholder="التكرار"
                  value={m.frequency}
                  onChange={(e) => updateMed(i, { frequency: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMeds((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p))}
                  aria-label="حذف"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {errors.medications && (
              <p className="text-destructive text-xs">{errors.medications[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>تعليمات الجرعة العامة</Label>
            <Textarea name="dosage" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>ملاحظات</Label>
            <Textarea name="notes" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الحفظ…" : "حفظ الوصفة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
