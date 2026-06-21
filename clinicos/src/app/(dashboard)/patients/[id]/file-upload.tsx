"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadPatientFile } from "./actions";

export function FileUpload({ patientId }: { patientId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileType, setFileType] = useState("pdf");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("file_type", fileType);
    startTransition(async () => {
      const result = await uploadPatientFile(patientId, formData);
      if (result.ok) {
        toast.success("تم رفع الملف.");
        formRef.current?.reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <Input
        name="file"
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        required
        className="max-w-xs"
      />
      <Select value={fileType} onValueChange={setFileType}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pdf">PDF</SelectItem>
          <SelectItem value="xray">أشعة</SelectItem>
          <SelectItem value="lab">تحاليل</SelectItem>
          <SelectItem value="other">أخرى</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" disabled={isPending}>
        <Upload className="size-4" />
        {isPending ? "جارٍ الرفع…" : "رفع"}
      </Button>
    </form>
  );
}
