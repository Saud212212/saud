"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSubscriptionCheckout } from "./actions";
import type { PlanKey } from "@/lib/stripe/plans";

type Props = {
  planKey: PlanKey;
  name: string;
  priceLabel: string;
  features: string[];
  current: boolean;
};

export function PlanCard({ planKey, name, priceLabel, features, current }: Props) {
  const [isPending, startTransition] = useTransition();

  function subscribe() {
    startTransition(async () => {
      const result = await createSubscriptionCheckout(planKey);
      if (result.ok) {
        window.location.href = result.url;
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className={current ? "border-primary" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{name}</span>
          {current && <span className="text-primary text-xs">خطتك الحالية</span>}
        </CardTitle>
        <p className="text-2xl font-bold">{priceLabel}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="text-primary size-4" />
              {f}
            </li>
          ))}
        </ul>
        <Button onClick={subscribe} disabled={isPending} className="w-full">
          {isPending ? "جارٍ التحويل…" : current ? "تجديد/تغيير" : "اشترك"}
        </Button>
      </CardContent>
    </Card>
  );
}
