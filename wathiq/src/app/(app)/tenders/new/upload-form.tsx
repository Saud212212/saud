"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Lock, UploadCloud, X } from "lucide-react";
import clsx from "clsx";
import { Button, Card } from "@/components/ui";
import { formatBytes } from "@/lib/format";

type Role = "booklet" | "annex" | "boq" | "other";
interface Picked {
  id: string;
  file: File;
  role: Role;
}

export function UploadForm({ maxMb }: { maxMb: number }) {
  const t = useTranslations("upload");
  const locale = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [drag, setDrag] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next: Picked[] = [];
    for (const f of Array.from(list)) {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        setError(t("errorNotPdf", { name: f.name }));
        continue;
      }
      next.push({ id: `${f.name}-${f.size}-${Math.random()}`, file: f, role: files.length + next.length === 0 ? "booklet" : "annex" });
    }
    setFiles((cur) => [...cur, ...next].slice(0, 10));
    if (!title && next[0]) setTitle(next[0].file.name.replace(/\.pdf$/i, ""));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length || !title.trim()) return;
    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("reference", reference.trim());
    for (const f of files) {
      fd.append("files", f.file);
      fd.append("roles", f.role);
    }
    // XHR بدل fetch لعرض تقدم الرفع
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/tenders");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      if (xhr.status === 201) {
        const { tenderId } = JSON.parse(xhr.responseText);
        router.push(`/tenders/${tenderId}`);
      } else {
        setPct(null);
        let message = String(xhr.status);
        try {
          message = JSON.parse(xhr.responseText).message ?? message;
        } catch {}
        setError(t("errorGeneric", { message }));
      }
    };
    xhr.onerror = () => {
      setPct(null);
      setError(t("errorGeneric", { message: "network" }));
    };
    setPct(0);
    xhr.send(fd);
  };

  const busy = pct !== null;

  return (
    <form onSubmit={submit}>
      <Card className="space-y-6 p-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">{t("tenderTitle")}</span>
            <input
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tenderTitlePh")}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none placeholder:text-muted focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t("reference")}</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              dir="ltr"
              inputMode="numeric"
              className="num h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-start text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium">{t("files")}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
            className={clsx(
              "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              drag ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-2 hover:border-brand",
            )}
          >
            <UploadCloud className="mb-3 h-8 w-8 text-brand" />
            <span className="text-sm font-medium">{t("drop")}</span>
            <span className="mt-1 text-xs text-muted">{t("dropHint", { max: maxMb })}</span>
          </button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => add(e.target.files)} />

          {files.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" dir="auto">
                      {f.file.name}
                    </div>
                    <div className="text-xs text-muted">{formatBytes(f.file.size, locale)}</div>
                  </div>
                  <select
                    aria-label={t("role")}
                    value={f.role}
                    onChange={(e) => setFiles((cur) => cur.map((x) => (x.id === f.id ? { ...x, role: e.target.value as Role } : x)))}
                    className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm"
                  >
                    {(["booklet", "annex", "boq", "other"] as const).map((r) => (
                      <option key={r} value={r}>
                        {t(`roles.${r}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}
                    className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                    aria-label={t("remove")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" />
            {t("encryptedNote")}
          </p>
          <Button type="submit" disabled={busy || !files.length || !title.trim()} className="min-w-44">
            {busy ? t("uploading", { pct }) : t("submit")}
          </Button>
        </div>
        {busy && (
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </Card>
    </form>
  );
}
