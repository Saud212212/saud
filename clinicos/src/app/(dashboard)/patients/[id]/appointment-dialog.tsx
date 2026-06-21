"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createAppointment } from "./actions";

export type DoctorOption = { id: string; label: string };

export function AppointmentDialog({
  patientId,
  doctors,
  trigger,
}: {
  patientId: string;
  doctors: DoctorOption[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("patient_id", patientId);
    formData.set("doctor_id", doctorId);
    setErrors({});
    startTransition(async () => {
      const result = await createAppointment(formData);
      if (result.ok) {
        toast.success("تم إضافة الموعد.");
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
          <DialogTitle>موعد جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>وقت الموعد</Label>
            <Input name="scheduled_at" type="datetime-local" dir="ltr" required />
            {errors.scheduled_at && (
              <p className="text-destructive text-xs">{errors.scheduled_at[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>الطبيب (اختياري)</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="بدون تحديد" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>ملاحظات</Label>
            <Textarea name="notes" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الحفظ…" : "حفظ الموعد"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
