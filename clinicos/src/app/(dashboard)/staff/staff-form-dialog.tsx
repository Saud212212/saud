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
import { updateStaff } from "./actions";
import { ASSIGNABLE_ROLES } from "@/lib/validation/staff";

const ROLE_LABEL: Record<string, string> = {
  clinic_admin: "مدير العيادة",
  doctor: "طبيب",
  receptionist: "موظف استقبال",
};

type StaffMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

export function StaffFormDialog({
  member,
  trigger,
}: {
  member: StaffMember;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isActive, setIsActive] = useState(member.is_active);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("is_active", String(isActive));
    setErrors({});

    startTransition(async () => {
      const result = await updateStaff(member.id, formData);
      if (result.ok) {
        toast.success("تم حفظ التعديلات.");
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
          <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          <DialogDescription dir="ltr" className="text-start">
            {member.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label>الاسم الكامل</Label>
            <Input name="full_name" defaultValue={member.full_name ?? ""} />
            {errors.full_name && (
              <p className="text-destructive text-xs">{errors.full_name[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>الدور</Label>
            <Select name="role" defaultValue={member.role}>
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
            {errors.role && (
              <p className="text-destructive text-xs">{errors.role[0]}</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4"
            />
            حساب مُفعّل
          </label>

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
