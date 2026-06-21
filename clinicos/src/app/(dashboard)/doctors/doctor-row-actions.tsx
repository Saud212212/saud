"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorFormDialog } from "./doctor-form-dialog";
import { setDoctorActive } from "./actions";
import type { Tables } from "@/types/database.types";

export function DoctorRowActions({ doctor }: { doctor: Tables<"doctors"> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setDoctorActive(doctor.id, !doctor.is_active);
      if (result.ok) {
        toast.success(doctor.is_active ? "تمت الأرشفة." : "تمت الاستعادة.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <DoctorFormDialog
        mode="edit"
        doctor={doctor}
        trigger={
          <Button variant="ghost" size="icon" aria-label="تعديل">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleActive}
        disabled={isPending}
        aria-label={doctor.is_active ? "أرشفة" : "استعادة"}
      >
        {doctor.is_active ? (
          <Archive className="size-4" />
        ) : (
          <ArchiveRestore className="size-4" />
        )}
      </Button>
    </div>
  );
}
