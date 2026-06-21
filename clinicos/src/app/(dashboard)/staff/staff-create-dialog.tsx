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
import { createStaffAccount } from "./actions";
import { ASSIGNABLE_ROLES } from "@/lib/validation/staff";

const ROLE_LABEL: Record<string, string> = {
  clinic_admin: "مدير العيادة",
  doctor: "طبيب",
  receptionist: "موظف استقبال",
};

export function StaffCreateDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErrors({});

    startTransition(async () => {
      const result = await createStaffAccount(formData);
      if (result.ok) {
        toast.success("تم إنشاء حساب الموظف.");
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
          <DialogTitle>إنشاء حساب موظف</DialogTitle>
          <DialogDescription>
            يُنشأ حساب دخول بكلمة مرور ابتدائية تُسلّمها للموظف.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <Field label="الاسم الكامل" error={errors.full_name}>
            <Input name="full_name" required />
          </Field>
          <Field label="البريد الإلكتروني" error={errors.email}>
            <Input name="email" type="email" dir="ltr" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="الدور" error={errors.role}>
              <Select name="role" defaultValue="receptionist">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="كلمة المرور الابتدائية" error={errors.password}>
              <Input name="password" type="password" dir="ltr" required />
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
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
