import { Users, CalendarDays, DollarSign, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardOverview() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // RLS scopes every query to the admin's clinic automatically.
  const [{ count: patientCount }, { count: todayCount }, { data: invoices }] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today),
    supabase.from("invoices").select("total_amount, amount_paid, status"),
  ]);

  const revenue = (invoices ?? []).reduce((sum, i) => sum + Number(i.amount_paid ?? 0), 0);
  const pending = (invoices ?? [])
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + (Number(i.total_amount) - Number(i.amount_paid)), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total patients" value={patientCount ?? 0} icon={Users} />
        <StatCard title="Today's appointments" value={todayCount ?? 0} icon={CalendarDays} />
        <StatCard title="Revenue collected" value={formatCurrency(revenue)} icon={DollarSign} />
        <StatCard title="Pending payments" value={formatCurrency(pending)} icon={AlertCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Welcome to your clinic dashboard. From the sidebar you can manage doctors,
          staff, patients, appointments and billing.</p>
          <p>This is the Phase 1 foundation — data is live and clinic-isolated via Supabase RLS.
          The feature modules (calendar, invoice builder, analytics charts) build on top of
          the schema and helpers already in place.</p>
        </CardContent>
      </Card>
    </div>
  );
}
