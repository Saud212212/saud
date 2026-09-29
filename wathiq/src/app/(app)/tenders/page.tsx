import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileUp, FileText } from "lucide-react";
import { requireSession, ctxOf } from "@/server/auth/session";
import { listTenders } from "@/server/services/tenders";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { TenderStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getTranslations("tenders"))("title") };
}

export default async function TendersPage() {
  const session = await requireSession();
  const t = await getTranslations("tenders");
  const tNav = await getTranslations("nav");
  const locale = await getLocale();
  const tenders = await listTenders(ctxOf(session));
  const canUpload = session.role !== "reviewer";

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          canUpload && (
            <LinkButton href="/tenders/new">
              <FileUp className="h-4 w-4" />
              {tNav("newTender")}
            </LinkButton>
          )
        }
      />
      {tenders.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
            <FileText className="h-7 w-7" />
          </div>
          <p className="max-w-sm text-sm text-muted">{t("empty")}</p>
          {canUpload && (
            <LinkButton href="/tenders/new" className="mt-6">
              {t("uploadFirst")}
            </LinkButton>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("colTitle")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("colRef")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("colFiles")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("colPages")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("colStatus")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("colCreated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tenders.map((x) => (
                  <tr key={x.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Link href={`/tenders/${x.id}`} className="font-medium text-ink hover:text-brand">
                        {x.title}
                      </Link>
                    </td>
                    <td className="num px-4 py-3 text-ink-2" dir="ltr">
                      <span className="block text-start">{x.referenceNumber ?? "—"}</span>
                    </td>
                    <td className="num px-4 py-3 text-ink-2">{x.files}</td>
                    <td className="num px-4 py-3 text-ink-2">{x.pages}</td>
                    <td className="px-4 py-3">
                      <TenderStatusBadge status={x.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-2">{formatDate(x.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
