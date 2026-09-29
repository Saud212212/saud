"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export function RerunAnalysis({ tenderId, label }: { tenderId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/tenders/${tenderId}/analyze`, { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {label}
    </Button>
  );
}
