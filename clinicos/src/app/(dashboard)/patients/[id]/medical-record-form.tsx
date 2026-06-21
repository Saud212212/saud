"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertMedicalRecord } from "./actions";

type Record = {
  chronic_diseases: string | null;
  allergies: string | null;
  past_surgeries: string | null;
  current_medications: string | null;
  notes: string | null;
} | null;

const FIELDS: { name: string; label: string }[] = [
  { name: "chronic_diseases", label: "الأمراض المزمنة" },
  { name: "allergies", label: "الحساسية" },
  { name: "past_surgeries", label: "العمليات السابقة" },
  { name: "current_medications", label: "الأدوية الحالية" },
  { name: "notes", label: "ملاحظات" },
];

export function MedicalRecordForm({
  patientId,
  record,
  canWrite,
}: {
  patientId: string;
  record: Record;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertMedicalRecord(patientId, formData);
      if (result.ok) {
        toast.success("تم حفظ السجل الطبي.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        {FIELDS.map((f) => (
          <div key={f.name}>
            <p className="text-muted-foreground text-xs">{f.label}</p>
            <p className="whitespace-pre-wrap text-sm">
              {(record?.[f.name as keyof typeof record] as string) || "—"}
            </p>
          </div>
        ))}
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            تعديل السجل الطبي
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {FIELDS.map((f) => (
        <div key={f.name} className="flex flex-col gap-1.5">
          <Label>{f.label}</Label>
          <Textarea
            name={f.name}
            defaultValue={(record?.[f.name as keyof typeof record] as string) ?? ""}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
