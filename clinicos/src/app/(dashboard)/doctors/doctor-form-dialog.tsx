"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createDoctor, updateDoctor } from "./actions";
import type { Tables } from "@/types/database.types";

type Doctor = Tables<"doctors">;

type Props = {
  mode: "create" | "edit";
  doctor?: Doctor;
  trigger: React.ReactNode;
};

export function DoctorFormDialog({ mode, doctor, trigger }: Props) {
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
          ? await createDoctor(formData)
          : await updateDoctor(doctor!.id, formData);

      if (result.ok) {
        toast.success(mode === "create" ? "تمت إضافة الطبيب." : "تم حفظ التعديلات.");
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
            {mode === "create" ? "إضافة طبيب جديد" : "تعديل بيانات الطبيب"}
          </DialogTitle>
          <DialogDescription>أدخل بيانات الطبيب المهنية.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="الاسم الكامل" error={errors.full_name}>
            <Input
              name="full_name"
              defaultValue={doctor?.full_name ?? ""}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="التخصص" error={errors.specialty}>
              <Input name="specialty" defaultValue={doctor?.specialty ?? ""} />
            </Field>
            <Field label="رقم الترخيص" error={errors.license_number}>
              <Input
                name="license_number"
                defaultValue={doctor?.license_number ?? ""}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="رقم الهاتف" error={errors.phone}>
              <Input name="phone" dir="ltr" defaultValue={doctor?.phone ?? ""} />
            </Field>
            <Field label="البريد الإلكتروني" error={errors.email}>
              <Input
                name="email"
                type="email"
                dir="ltr"
                defaultValue={doctor?.email ?? ""}
              />
            </Field>
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
