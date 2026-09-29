import clsx from "clsx";
import { Card } from "@/components/ui";

export function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "warn" | "danger" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={clsx("num mt-1 text-2xl font-semibold", tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-ink")}>{value}</div>
      {hint && <div className="num mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
