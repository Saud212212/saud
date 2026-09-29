import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, FileSearch } from "lucide-react";
import { getSummary, listItems, type FactView } from "@/server/services/analysis";
import { Card } from "@/components/ui";
import { VerificationBadge } from "@/components/verification-badge";
import { loadTender, orNotFound } from "./load";

const SECTIONS: { key: string; fields: string[] }[] = [
  { key: "basic", fields: ["entity", "tender_number", "title", "type", "location"] },
  { key: "money", fields: ["booklet_price", "initial_guarantee", "final_guarantee"] },
  { key: "dates", fields: ["duration", "dates.inquiries_deadline", "dates.submission_deadline", "dates.opening_date"] },
  { key: "evaluation", fields: ["evaluation.technical_weight", "evaluation.financial_weight", "evaluation.min_technical_score"] },
  { key: "localContent", fields: ["local_content.requirements", "local_content.sme_preference"] },
];

const sourceHref = (tenderId: string, f: FactView) =>
  f.source.tenderFileId && (f.source.matchedPage ?? f.source.statedPage)
    ? `/tenders/${tenderId}/files/${f.source.tenderFileId}/pages/${f.source.matchedPage ?? f.source.statedPage}?fact=${f.id}`
    : null;

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, detail } = await loadTender(id);
  const t = await getTranslations("summary");
  const facts = await orNotFound(getSummary(ctx, id));

  if (facts.size === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <FileSearch className="mb-3 h-8 w-8 text-muted" />
        <p className="max-w-md text-sm text-muted">{detail.tender.status === "ready" ? t("notMentioned") : t("pending")}</p>
      </Card>
    );
  }
  const notes = (await listItems(ctx, id)).filter((i) => i.kind === "verify_note");

  const Source = ({ f }: { f: FactView }) => {
    const href = sourceHref(id, f);
    const label = [
      f.source.fileName,
      (f.source.matchedPage ?? f.source.statedPage) ? t("page", { n: f.source.matchedPage ?? f.source.statedPage ?? 0 }) : null,
      f.source.clause ? t("clause", { c: f.source.clause }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return href ? (
      <Link href={href} className="text-xs text-brand hover:underline" title={f.source.quote ?? undefined}>
        <span dir="auto">{label}</span>
      </Link>
    ) : (
      <span className="text-xs text-muted">—</span>
    );
  };

  const FieldRow = ({ field }: { field: string }) => {
    const list = facts.get(field) ?? [];
    const primary = list.find((f) => f.isPrimary) ?? list[0];
    const others = list.filter((f) => f !== primary && f.source.verification !== "unverified");
    return (
      <div className="grid gap-x-4 gap-y-1 border-b border-line py-3 last:border-0 sm:grid-cols-[11rem_1fr_auto]">
        <dt className="text-sm text-muted">{t(`fields.${field}` as "fields.entity")}</dt>
        <dd className="min-w-0 text-sm">
          {primary ? (
            <>
              <div className="font-medium leading-7" dir="auto">
                {String(primary.value.value ?? "")}
                {primary.value.calendar ? <span className="ms-2 text-xs text-muted">{t("calendar", { c: String(primary.value.calendar) })}</span> : null}
              </div>
              {primary.conflict && (
                <div className="mt-2 rounded-lg border border-warn/30 bg-warn-soft p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-warn">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t("conflict")}
                  </div>
                  <p className="mt-1 text-ink-2">{t("conflictHint")}</p>
                  <ul className="mt-1.5 space-y-1">
                    {others.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-medium" dir="auto">{String(o.value.value ?? "")}</span>
                        <Source f={o} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <span className="text-muted">{t("notMentioned")}</span>
          )}
        </dd>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {primary && (
            <>
              <VerificationBadge status={primary.source.verification} reasons={primary.source.reasons} />
              <Source f={primary} />
            </>
          )}
        </div>
      </div>
    );
  };

  const criteria = (facts.get("evaluation.criteria") ?? []).filter((c) => c.isPrimary);
  const listItemsLC = (facts.get("local_content.mandatory_list_items") ?? []).filter((c) => c.isPrimary);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {SECTIONS.map((s) => (
        <Card key={s.key} className="p-5">
          <h2 className="mb-1 text-base font-semibold">{t(`sections.${s.key}` as "sections.basic")}</h2>
          <dl>
            {s.fields.map((f) => (
              <FieldRow key={f} field={f} />
            ))}
          </dl>
          {s.key === "evaluation" && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">{t("criteria")}</h3>
              {criteria.length === 0 ? (
                <p className="text-sm text-muted">{t("noCriteria")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-1.5 text-start font-medium">{t("criterion")}</th>
                      <th className="py-1.5 text-start font-medium">{t("weight")}</th>
                      <th className="py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {criteria.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2" dir="auto">
                          {String(c.value.name)}
                          {Array.isArray(c.value.sub_criteria) && c.value.sub_criteria.length > 0 && (
                            <div className="text-xs text-muted">{(c.value.sub_criteria as string[]).join("، ")}</div>
                          )}
                        </td>
                        <td className="num py-2">{String(c.value.weight ?? "—")}</td>
                        <td className="py-2 text-end">
                          <span className="inline-flex flex-wrap items-center justify-end gap-2">
                            <VerificationBadge status={c.source.verification} reasons={c.source.reasons} />
                            <Source f={c} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {s.key === "localContent" && listItemsLC.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">{t("fields.local_content.mandatory_list_items")}</h3>
              <ul className="space-y-1.5 text-sm">
                {listItemsLC.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span dir="auto">{String(i.value.value)}</span>
                    <span className="inline-flex items-center gap-2">
                      <VerificationBadge status={i.source.verification} reasons={i.source.reasons} />
                      <Source f={i} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
      <Card className="p-5">
        <h2 className="mb-2 text-base font-semibold">{t("sections.notes")}</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-muted">{t("noNotes")}</p>
        ) : (
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-ink-2">
            {notes.map((n) => (
              <li key={n.id} dir="auto">
                {String(n.content.note)}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
