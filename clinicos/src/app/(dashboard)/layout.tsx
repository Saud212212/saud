import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { homePathForRole, type AppRole } from "@/types/rbac";
import { signOut } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير المنصّة",
  clinic_admin: "مدير العيادة",
  doctor: "طبيب",
  receptionist: "موظف استقبال",
};

/** روابط التنقّل المتاحة لكل دور. */
function navLinksForRole(role: AppRole): { href: string; label: string }[] {
  const links = [{ href: homePathForRole(role), label: "الرئيسية" }];
  if (role === "super_admin") {
    links.push({ href: "/admin/clinics", label: "العيادات" });
  }
  if (role !== "super_admin") {
    links.push({ href: "/patients", label: "المرضى" });
    links.push({ href: "/doctors", label: "الأطباء" });
  }
  if (role === "clinic_admin") {
    links.push({ href: "/staff", label: "الموظفون" });
  }
  return links;
}

/**
 * تخطيط اللوحات المحمية: يتطلّب جلسة مستخدم، ويعرض شريطاً علوياً مشتركاً.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const navLinks = navLinksForRole(user.role);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="font-semibold">ClinicOS</span>
            <span className="text-muted-foreground text-xs">
              {ROLE_LABELS[user.role] ?? user.role} — {user.email}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Button key={link.href} asChild variant="ghost" size="sm">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            تسجيل الخروج
          </Button>
        </form>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
