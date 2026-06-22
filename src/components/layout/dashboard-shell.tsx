import Link from "next/link";
import { Activity } from "lucide-react";
import type { AppUser } from "@/types/database";
import { SignOutButton } from "./sign-out-button";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DashboardShellProps {
  user: Pick<AppUser, "full_name" | "email" | "role">;
  nav: NavItem[];
  title: string;
  children: React.ReactNode;
}

// Shared responsive shell: sidebar + top bar. Server component — pass a
// server-fetched user. Roles get their own nav config.
export function DashboardShell({ user, nav, title, children }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Activity className="size-6 text-primary" />
          <span className="text-lg font-bold">ClinicOS</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{user.full_name ?? user.email}</p>
          <p className="capitalize">{user.role.replace("_", " ")}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.full_name ?? user.email}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
