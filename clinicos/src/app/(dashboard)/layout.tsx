import { requireUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "مدير المنصّة",
  clinic_admin: "مدير العيادة",
  doctor: "طبيب",
  receptionist: "موظف استقبال",
};

/**
 * تخطيط اللوحات المحمية: يتطلّب جلسة مستخدم، ويعرض شريطاً علوياً مشتركاً.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex flex-col">
          <span className="font-semibold">ClinicOS</span>
          <span className="text-muted-foreground text-xs">
            {ROLE_LABELS[user.role] ?? user.role} — {user.email}
          </span>
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
