import {
  LayoutDashboard,
  Stethoscope,
  UsersRound,
  CalendarDays,
  Receipt,
  BarChart3,
  Settings,
  CreditCard,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const nav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Doctors", href: "/dashboard/doctors", icon: Stethoscope },
  { label: "Staff", href: "/dashboard/staff", icon: UsersRound },
  { label: "Patients", href: "/dashboard/patients", icon: UsersRound },
  { label: "Appointments", href: "/dashboard/appointments", icon: CalendarDays },
  { label: "Invoices", href: "/dashboard/invoices", icon: Receipt },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("clinic_admin");
  return (
    <DashboardShell user={user} nav={nav} title="Clinic Dashboard">
      {children}
    </DashboardShell>
  );
}
