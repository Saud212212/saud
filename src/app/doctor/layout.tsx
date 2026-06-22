import { LayoutDashboard, CalendarDays, Users, FileText, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const nav: NavItem[] = [
  { label: "Today", href: "/doctor", icon: LayoutDashboard },
  { label: "Schedule", href: "/doctor/schedule", icon: CalendarDays },
  { label: "Patients", href: "/doctor/patients", icon: Users },
  { label: "Records", href: "/doctor/records", icon: FileText },
  { label: "Availability", href: "/doctor/availability", icon: Clock },
];

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("doctor");
  return (
    <DashboardShell user={user} nav={nav} title="Doctor Portal">
      {children}
    </DashboardShell>
  );
}
