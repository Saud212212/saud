import { LayoutDashboard, UserPlus, CalendarPlus, Receipt, CheckSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const nav: NavItem[] = [
  { label: "Today", href: "/reception", icon: LayoutDashboard },
  { label: "Register patient", href: "/reception/register-patient", icon: UserPlus },
  { label: "Book appointment", href: "/reception/book", icon: CalendarPlus },
  { label: "Check-in", href: "/reception/check-in", icon: CheckSquare },
  { label: "Invoices", href: "/reception/invoices", icon: Receipt },
];

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("receptionist");
  return (
    <DashboardShell user={user} nav={nav} title="Reception">
      {children}
    </DashboardShell>
  );
}
