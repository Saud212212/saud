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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPatient, updatePatient } from "./actions";
import type { Tables } from "@/types/database.types";

type Patient = Tables<"patients">;

type Props = {
  mode: "create" | "edit";
  patient?: Patient;
  trigger: React.ReactNode;
};

export function PatientFormDialog({ mode, patient, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErrors({});

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPatient(formData)
          : await updatePatient(patient!.id, formData);

      if (result.ok) {
        toast.success(mode === "create" ? "تمت إضافة المريض." : "تم حفظ التعديلات.");
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
          <DialogTitle>
            {mode === "create" ? "إضافة مريض جديد" : "تعديل بيانات المريض"}
          </DialogTitle>
          <DialogDescription>
            رقم الملف يُولَّد تلقائياً عند الإضافة.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="الاسم الكامل" error={errors.full_name}>
            <Input
              name="full_name"
              defaultValue={patient?.full_name ?? ""}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="رقم الهاتف" error={errors.phone}>
              <Input name="phone" dir="ltr" defaultValue={patient?.phone ?? ""} />
            </Field>
            <Field label="البريد الإلكتروني" error={errors.email}>
              <Input
                name="email"
                type="email"
                dir="ltr"
                defaultValue={patient?.email ?? ""}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="الجنس" error={errors.gender}>
              <Select name="gender" defaultValue={patient?.gender ?? undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">ذكر</SelectItem>
                  <SelectItem value="female">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="العمر" error={errors.age}>
              <Input
                name="age"
                type="number"
                min={0}
                max={150}
                defaultValue={patient?.age ?? ""}
              />
            </Field>
            <Field label="تاريخ الميلاد" error={errors.date_of_birth}>
              <Input
                name="date_of_birth"
                type="date"
                dir="ltr"
                defaultValue={patient?.date_of_birth ?? ""}
              />
            </Field>
          </div>

          <Field label="العنوان" error={errors.address}>
            <Textarea name="address" defaultValue={patient?.address ?? ""} />
          </Field>

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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-destructive text-xs">{error[0]}</p>}
    </div>
  );
}
