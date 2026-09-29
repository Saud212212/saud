"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { ExternalLink, Search, ShieldAlert, Copy } from "lucide-react";
import type { RequirementView } from "@/server/services/analysis";
import { Badge, Button, Card } from "@/components/ui";
import { VerificationBadge } from "@/components/verification-badge";

type Tab = "requirements" | "unverified" | "similar";

const CATEGORIES = ["regulatory", "administrative", "technical", "financial", "local_content", "quality", "safety", "operations"];
const normalize = (s: string) => s.replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();

export function Matrix({ tenderId, rows, canEdit }: { tenderId: string; rows: RequirementView[]; canEdit: boolean }) {
  const t = useTranslations("matrix");
  const tc = useTranslations("categories");
  const to = useTranslations("obligations");
  const tv = useTranslations("verification");
  const ts = useTranslations("summary");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("requirements");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [obl, setObl] = useState("");
  const [ver, setVer] = useState("");
  const [disq, setDisq] = useState(false);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  const shown = rows.filter((r) => r.source.verification !== "unverified");
  const unverified = rows.filter((r) => r.source.verification === "unverified");
  const groups = useMemo(() => {
    const m = new Map<string, RequirementView[]>();
    for (const r of shown) if (r.similarGroupId) m.set(r.similarGroupId, [...(m.get(r.similarGroupId) ?? []), r]);
    return [...m.entries()].filter(([, v]) => v.length > 1);
  }, [shown]);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return shown.filter(
      (r) =>
        (!nq || normalize(`${r.code} ${r.text} ${r.evidenceRequired ?? ""} ${r.source.clause ?? ""}`).includes(nq)) &&
        (!cat || (r.category ?? "unknown") === cat) &&
        (!obl || (r.obligation ?? "unknown") === obl) &&
        (!ver || r.source.verification === ver) &&
        (!disq || r.disqualifying),
    );
  }, [shown, q, cat, obl, ver, disq]);

  const href = (r: RequirementView) => {
    const page = r.source.matchedPage ?? r.source.statedPage;
    return r.source.tenderFileId && page ? `/tenders/${tenderId}/files/${r.source.tenderFileId}/pages/${page}?req=${r.id}` : null;
  };

  const resolve = async (groupId: string, body: Record<string, string>) => {
    setBusyGroup(groupId);
    await fetch(`/api/tenders/${tenderId}/requirements/similar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, ...body }),
    });
    router.refresh();
    setBusyGroup(null);
  };

  const sourceLabel = (r: RequirementView) =>
    [r.source.fileName, ts("page", { n: r.source.matchedPage ?? r.source.statedPage ?? 0 }), r.source.clause ? ts("clause", { c: r.source.clause }) : null]
      .filter(Boolean)
      .join(" · ");

  const select = (value: string, set: (v: string) => void, label: string, options: [string, string][]) => (
    <select value={value} onChange={(e) => set(e.target.value)} aria-label={label} className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm">
      <option value="">
        {label}: {t("all")}
      </option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        {(
          [
            ["requirements", t("tabs.requirements"), shown.length],
            ["unverified", t("tabs.unverified"), unverified.length],
            ["similar", t("tabs.similar"), groups.length],
          ] as [Tab, string, number][]
        ).map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={clsx("flex items-center gap-2 rounded-md px-3 py-1.5 font-medium", tab === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {label}
            <span className={clsx("num rounded-full px-1.5 text-xs", k !== "requirements" && n > 0 ? "bg-danger-soft text-danger" : "bg-line text-ink-2")}>{n}</span>
          </button>
        ))}
      </div>

      {tab === "requirements" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search")}
                className="h-9 w-full rounded-lg border border-line-strong bg-surface ps-9 pe-3 text-sm outline-none focus:border-brand"
              />
            </label>
            {select(cat, setCat, t("filters.category"), [...CATEGORIES, "unknown"].map((c) => [c, tc(c as "regulatory")]))}
            {select(obl, setObl, t("filters.obligation"), ["mandatory", "preferred", "informational"].map((o) => [o, to(o as "mandatory")]))}
            {select(ver, setVer, t("filters.verification"), ["verified", "verified_corrected_page", "needs_review"].map((v) => [v, tv(v as "verified")]))}
            <label className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm">
              <input type="checkbox" checked={disq} onChange={(e) => setDisq(e.target.checked)} className="accent-[var(--brand)]" />
              {t("filters.disqualifyingOnly")}
            </label>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2.5 text-start font-medium">{t("cols.code")}</th>
                    <th className="min-w-72 px-3 py-2.5 text-start font-medium">{t("cols.requirement")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("cols.category")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("cols.obligation")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("cols.disqualifying")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("cols.source")}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t("cols.verification")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((r) => {
                    const h = href(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => h && router.push(h)}
                        className={clsx("align-top", h && "cursor-pointer hover:bg-surface-2")}
                        title={h ? t("openSource") : undefined}
                      >
                        <td className="num whitespace-nowrap px-3 py-3 font-medium" dir="ltr">
                          <span className="block text-start">{r.code}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="leading-7" dir="auto">
                            {r.text}
                          </div>
                          {r.evidenceRequired && <div className="mt-0.5 text-xs text-muted">{t("evidence", { e: r.evidenceRequired })}</div>}
                          {r.similarGroupId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTab("similar");
                              }}
                              className="mt-1"
                            >
                              <Badge tone="accent">
                                <Copy className="h-3 w-3" />
                                {t("similarBadge")}
                              </Badge>
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{tc((r.category ?? "unknown") as "regulatory")}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge tone={r.obligation === "mandatory" ? "brand" : "neutral"}>{to((r.obligation ?? "unknown") as "mandatory")}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          {r.disqualifying ? (
                            <Badge tone="danger">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              {t("yes")}
                            </Badge>
                          ) : (
                            <span className="text-muted">{t("no")}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {h ? (
                            <Link href={h} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                              <span dir="auto">{sourceLabel(r)}</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-muted">{sourceLabel(r)}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <VerificationBadge status={r.source.verification} reasons={r.source.reasons} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">{t("empty")}</p>}
          </Card>
        </>
      )}

      {tab === "unverified" && (
        <div className="space-y-3">
          <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm leading-6 text-ink-2">{t("unverifiedIntro")}</p>
          {unverified.length === 0 && <p className="text-sm text-muted">{t("unverifiedNone")}</p>}
          {unverified.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="num font-semibold text-ink">{r.code}</span>
                <VerificationBadge status="unverified" reasons={r.source.reasons} />
                <span dir="auto">{sourceLabel(r)}</span>
              </div>
              <div className="text-sm leading-7" dir="auto">
                {r.text}
              </div>
              {r.source.quote && (
                <div className="mt-2 border-s-2 border-danger/40 ps-3 text-xs text-muted">
                  {t("claimedQuote")}: <span dir="auto">«{r.source.quote}»</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === "similar" && (
        <div className="space-y-4">
          <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm leading-6 text-ink-2">{t("similarIntro")}</p>
          {groups.length === 0 && <p className="text-sm text-muted">{t("similarNone")}</p>}
          {groups.map(([gid, members], gi) => (
            <Card key={gid} className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{t("group", { n: gi + 1 })}</span>
                {canEdit && (
                  <Button variant="secondary" disabled={busyGroup === gid} onClick={() => resolve(gid, { action: "keep_all" })}>
                    {t("keepAll")}
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-line">
                {members.map((r) => {
                  const h = href(r);
                  return (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="num font-semibold text-ink">{r.code}</span>
                          <Badge tone={r.obligation === "mandatory" ? "brand" : "neutral"}>{to((r.obligation ?? "unknown") as "mandatory")}</Badge>
                          {r.disqualifying && <Badge tone="danger">{t("cols.disqualifying")}</Badge>}
                          <VerificationBadge status={r.source.verification} reasons={r.source.reasons} />
                          {h ? (
                            <Link href={h} className="text-brand hover:underline">
                              <span dir="auto">{sourceLabel(r)}</span>
                            </Link>
                          ) : (
                            <span dir="auto">{sourceLabel(r)}</span>
                          )}
                        </div>
                        <div className="text-sm leading-7" dir="auto">
                          {r.text}
                        </div>
                      </div>
                      {canEdit && (
                        <Button variant="ghost" disabled={busyGroup === gid} onClick={() => resolve(gid, { action: "merge", keepId: r.id })}>
                          {t("keepOnly", { code: r.code })}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
