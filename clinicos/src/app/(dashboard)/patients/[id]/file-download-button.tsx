"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFileSignedUrl } from "./actions";

export function FileDownloadButton({ fileId }: { fileId: string }) {
  const [isPending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const result = await getFileSignedUrl(fileId);
      if (result.ok) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={open} disabled={isPending}>
      <Download className="size-4" />
      فتح
    </Button>
  );
}
