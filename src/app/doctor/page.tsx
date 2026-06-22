import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/types/database";

const statusVariant: Record<AppointmentStatus, "default" | "success" | "warning" | "secondary" | "destructive"> = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "secondary",
};

export default async function DoctorToday() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // RLS limits appointments to the doctor's own clinic + rows.
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, appointment_time, status, type, patient:patients(full_name, file_number)")
    .eq("appointment_date", today)
    .order("appointment_time");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" /> Today&apos;s appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!appts || appts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
          ) : (
            <ul className="divide-y">
              {appts.map((a) => {
                const patient = a.patient as unknown as { full_name: string; file_number: string } | null;
                return (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{patient?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.appointment_time?.slice(0, 5)} · {a.type}
                      </p>
                    </div>
                    <Badge variant={statusVariant[a.status as AppointmentStatus]}>{a.status}</Badge>
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
