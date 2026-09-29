import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, CircleHelp, FileCheck2 } from "lucide-react";
import { Badge } from "./ui";

export type Verification = "verified" | "verified_corrected_page" | "needs_review" | "unverified";

const tone = { verified: "ok", verified_corrected_page: "ok", needs_review: "warn", unverified: "danger" } as const;
const Icon = { verified: CheckCircle2, verified_corrected_page: FileCheck2, needs_review: AlertTriangle, unverified: CircleHelp };

/** شارة حالة التحقق مع الأسباب في تلميح. */
export function VerificationBadge({ status, reasons = [] }: { status: Verification; reasons?: string[] }) {
  const t = useTranslations("verification");
  const I = Icon[status];
  const title = reasons.map((r) => t(`reasons.${r}` as "reasons.not_found")).join(" · ");
  return (
    <span title={title || undefined}>
      <Badge tone={tone[status]}>
        <I className="h-3.5 w-3.5" />
        {t(status)}
      </Badge>
    </span>
  );
}
