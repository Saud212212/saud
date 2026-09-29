"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function TenderTabs({ base, tabs }: { base: string; tabs: { href: string; label: string; count?: number; warn?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="tabs">
      {tabs.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? path === base : path.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={clsx("num rounded-full px-1.5 text-xs", t.warn ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2")}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
