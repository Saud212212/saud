import { useTranslations } from "next-intl";
import { Badge } from "./ui";

const tones = { uploading: "neutral", processing: "accent", analyzing: "accent", ready: "ok", failed: "danger" } as const;

export function TenderStatusBadge({ status }: { status: keyof typeof tones }) {
  const t = useTranslations("tenders.status");
  return <Badge tone={tones[status]}>{t(status)}</Badge>;
}
