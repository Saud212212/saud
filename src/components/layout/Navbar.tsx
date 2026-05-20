"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/#solver", label: "حل المشاكل" },
  { href: "/#vault", label: "المكتبة" },
  { href: "/#toolkit", label: "الأدوات" },
  { href: "/#specializations", label: "التخصصات" },
  { href: "/#community", label: "المجتمع" },
  { href: "/#pricing", label: "الباقات" }
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "pt-2" : "pt-4"
      )}
    >
      <div className="container-x">
        <nav
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-500 sm:px-6",
            scrolled
              ? "glass-strong shadow-luxury"
              : "border border-white/5 bg-ink-950/40 backdrop-blur-md"
          )}
        >
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-engineering-900 via-engineering-700 to-ink-900 shadow-edge">
              <span className="absolute inset-0 bg-radial-gold opacity-70" />
              <Sparkles className="relative h-5 w-5 text-gold-300" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-extrabold tracking-tight">
                <span className="text-gradient-gold">EngHub</span>{" "}
                <span className="text-engineering-100">Pro</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-engineering-300">
                Engineering Oracle
              </span>
            </div>
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-engineering-100 transition-colors hover:bg-white/5 hover:text-gold-200"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/#login"
              className="text-sm font-medium text-engineering-100 hover:text-gold-200"
            >
              تسجيل الدخول
            </Link>
            <Link href="/#start" className="btn-gold text-sm">
              ابدأ مجانًا
            </Link>
          </div>

          <button
            type="button"
            aria-label="فتح القائمة"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-engineering-100 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {open && (
          <div className="glass-strong mt-2 rounded-2xl p-4 lg:hidden">
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-engineering-100 hover:bg-white/5 hover:text-gold-200"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/#login" className="btn-ghost text-sm">
                  تسجيل الدخول
                </Link>
                <Link href="/#start" className="btn-gold text-sm">
                  ابدأ مجانًا
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
