import { CalendarDays, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ReceptionToday() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: patientCount }, { data: appts }] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase
      .from("appointments")
      .select("id, appointment_time, status, patient:patients(full_name)")
      .eq("appointment_date", today)
      .order("appointment_time"),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard title="Total patients" value={patientCount ?? 0} icon={Users} />
        <StatCard title="Today's appointments" value={appts?.length ?? 0} icon={CalendarDays} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {!appts || appts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments booked for today.</p>
          ) : (
            <ul className="divide-y">
              {appts.map((a) => {
                const patient = a.patient as unknown as { full_name: string } | null;
                return (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{patient?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{a.appointment_time?.slice(0, 5)}</p>
                    </div>
                    <Badge variant="secondary">{a.status}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
