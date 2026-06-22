import { LayoutDashboard, Building2, CreditCard, ScrollText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";

const nav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Clinics", href: "/admin/clinics", icon: Building2 },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Audit logs", href: "/admin/audit", icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("super_admin");
  return (
    <DashboardShell user={user} nav={nav} title="Platform Admin">
      {children}
    </DashboardShell>
  );
}
