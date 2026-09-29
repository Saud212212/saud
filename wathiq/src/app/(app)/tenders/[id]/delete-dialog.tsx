"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

export function DeleteTender({ tenderId, title }: { tenderId: string; title: string }) {
  const t = useTranslations("delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tenders/${tenderId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/tenders");
      router.refresh();
    } else {
      setBusy(false);
      setError(res.status === 403 ? t("ownerOnly") : `${res.status}`);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="text-danger">
        <Trash2 className="h-4 w-4" />
        {t("button")}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <h2 id="del-title" className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm font-medium text-ink-2">{title}</p>
            <p className="mt-3 text-sm leading-6 text-muted">{t("body")}</p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm">{t("confirmLabel")}</span>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none focus:border-danger"
              />
            </label>
            {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                {t("cancel")}
              </Button>
              <Button variant="danger" onClick={confirm} disabled={busy || typed.trim() !== t("confirmWord")}>
                {t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
