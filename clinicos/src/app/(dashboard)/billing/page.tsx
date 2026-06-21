import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/stripe/plans";
import { isSubscriptionActive } from "@/lib/subscription";
import { PlanCard } from "./plan-card";

const STATUS_LABEL: Record<string, string> = {
  trialing: "تجريبي",
  active: "نشط",
  past_due: "متأخر السداد",
  canceled: "ملغى",
  incomplete: "غير مكتمل",
  unpaid: "غير مدفوع",
};

export default async function BillingPage() {
  const user = await requireRole(["clinic_admin"]);

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, plan, current_period_end")
    .eq("clinic_id", user.clinicId!)
    .single();

  const active = isSubscriptionActive(sub?.status);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">الاشتراك والفوترة</h1>

      <Card>
        <CardHeader>
          <CardTitle>اشتراك العيادة الحالي</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-muted-foreground text-sm">الخطة</p>
            <p className="font-semibold uppercase">{sub?.plan ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">الحالة</p>
            <Badge variant={active ? "secondary" : "destructive"}>
              {sub ? STATUS_LABEL[sub.status] ?? sub.status : "لا يوجد"}
            </Badge>
          </div>
          {sub?.current_period_end && (
            <div>
              <p className="text-muted-foreground text-sm">ينتهي في</p>
              <p className="font-medium">
                {new Date(sub.current_period_end).toLocaleDateString("ar")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!active && (
        <p className="text-destructive text-sm">
          اشتراك عيادتك غير فعّال — العمليات مقيّدة (وضع للقراءة فقط) حتى التجديد.
        </p>
      )}

      <div>
        <h2 className="mb-3 font-semibold">الخطط المتاحة</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard
              key={p.key}
              planKey={p.key}
              name={p.name}
              priceLabel={p.priceLabel}
              features={p.features}
              current={sub?.plan === p.key}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
