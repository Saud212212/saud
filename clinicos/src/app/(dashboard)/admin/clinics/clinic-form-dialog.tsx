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
import { createClinicWithAdmin } from "./actions";

export function ClinicFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErrors({});

    startTransition(async () => {
      const result = await createClinicWithAdmin(formData);
      if (result.ok) {
        toast.success("تم إنشاء العيادة وحساب مديرها.");
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
          <DialogTitle>إنشاء عيادة جديدة</DialogTitle>
          <DialogDescription>
            تُنشأ العيادة باشتراك تجريبي مع حساب مدير العيادة الأول.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم العيادة" error={errors.clinic_name}>
              <Input name="clinic_name" required />
            </Field>
            <Field label="المُعرّف (slug)" error={errors.slug}>
              <Input name="slug" dir="ltr" placeholder="my-clinic" required />
            </Field>
          </div>

          <Field label="الخطة" error={errors.plan}>
            <Select name="plan" defaultValue="free">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">مجاني</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">حساب مدير العيادة</p>
            <div className="grid gap-4">
              <Field label="الاسم الكامل" error={errors.admin_full_name}>
                <Input name="admin_full_name" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="البريد الإلكتروني" error={errors.admin_email}>
                  <Input name="admin_email" type="email" dir="ltr" required />
                </Field>
                <Field label="كلمة المرور الابتدائية" error={errors.admin_password}>
                  <Input name="admin_password" type="password" dir="ltr" required />
                </Field>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الإنشاء…" : "إنشاء العيادة"}
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
