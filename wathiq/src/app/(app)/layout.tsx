import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { requireSession } from "@/server/auth/session";
import { logout } from "../actions";
import { LocaleSwitch } from "@/components/locale-switch";
import { LogoMark } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/tenders" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link href="/tenders" className="rounded-md px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
              {t("nav.tenders")}
            </Link>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <div className="hidden text-end leading-tight md:block">
              <div className="text-sm font-medium">{session.userName}</div>
              <div className="text-xs text-muted">
                {session.orgName} · {t(`login.roles.${session.role}`)}
              </div>
            </div>
            <LocaleSwitch next={locale === "ar" ? "en" : "ar"} label={t("app.switchLang")} />
            <form action={logout}>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2" title={t("app.signOut")} aria-label={t("app.signOut")}>
                <LogOut className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
