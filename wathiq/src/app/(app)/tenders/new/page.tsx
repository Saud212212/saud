import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { PageHeader } from "@/components/ui";
import { UploadForm } from "./upload-form";

export async function generateMetadata() {
  return { title: (await getTranslations("upload"))("title") };
}

export default async function NewTenderPage() {
  const session = await requireSession();
  if (session.role === "reviewer") redirect("/tenders");
  const t = await getTranslations("upload");
  const tT = await getTranslations("tender");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/tenders" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowRight className="h-4 w-4 ltr:rotate-180" />
            {tT("back")}
          </Link>
        }
        title={t("title")}
        subtitle={t("subtitle")}
      />
      <UploadForm maxMb={env().MAX_UPLOAD_MB} />
    </div>
  );
}
