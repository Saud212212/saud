"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PatientFormDialog } from "./patient-form-dialog";
import { setPatientActive } from "./actions";
import type { Tables } from "@/types/database.types";

export function PatientRowActions({ patient }: { patient: Tables<"patients"> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setPatientActive(patient.id, !patient.is_active);
      if (result.ok) {
        toast.success(patient.is_active ? "تمت الأرشفة." : "تمت الاستعادة.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <PatientFormDialog
        mode="edit"
        patient={patient}
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
        aria-label={patient.is_active ? "أرشفة" : "استعادة"}
      >
        {patient.is_active ? (
          <Archive className="size-4" />
        ) : (
          <ArchiveRestore className="size-4" />
        )}
      </Button>
    </div>
  );
}
