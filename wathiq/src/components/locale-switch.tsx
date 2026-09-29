"use client";

import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { switchLocale } from "@/app/actions";

export function LocaleSwitch({ next, label }: { next: "ar" | "en"; label: string }) {
  const path = usePathname();
  return (
    <form action={switchLocale}>
      <input type="hidden" name="locale" value={next} />
      <input type="hidden" name="back" value={path} />
      <button className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink-2 hover:bg-surface-2" title={label}>
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </form>
  );
}
