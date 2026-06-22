import { Building2, Activity, FlaskConical, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { planForTier } from "@/lib/stripe/config";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Clinic } from "@/types/database";

export default async function AdminOverview() {
  const supabase = await createClient();

  // Super admin RLS allows reading across all clinics.
  const { data: clinics } = await supabase
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Clinic[]>();

  const all = clinics ?? [];
  const active = all.filter((c) => c.status === "active").length;
  const trialing = all.filter((c) => c.subscription_status === "trialing").length;
  // MRR from currently-active subscriptions.
  const mrr = all
    .filter((c) => c.subscription_status === "active")
    .reduce((sum, c) => sum + planForTier(c.subscription_tier).priceMonthly, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total clinics" value={all.length} icon={Building2} />
        <StatCard title="Active clinics" value={active} icon={Activity} />
        <StatCard title="On trial" value={trialing} icon={FlaskConical} />
        <StatCard title="MRR" value={formatCurrency(mrr)} hint="Active subscriptions" icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinics</CardTitle>
        </CardHeader>
        <CardContent>
          {all.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clinics yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2 text-start font-medium">Name</th>
                    <th className="px-2 py-2 text-start font-medium">Tier</th>
                    <th className="px-2 py-2 text-start font-medium">Status</th>
                    <th className="px-2 py-2 text-start font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2 py-3 font-medium">{c.name}</td>
                      <td className="px-2 py-3 capitalize">{c.subscription_tier}</td>
                      <td className="px-2 py-3">
                        <Badge variant={c.status === "active" ? "success" : "secondary"}>
                          {c.subscription_status}
                        </Badge>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
