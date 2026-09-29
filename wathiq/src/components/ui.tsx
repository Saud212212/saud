import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={clsx("rounded-xl border border-line bg-surface", className)} {...p} />;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | "accent";
const toneCls: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  brand: "bg-brand-soft text-brand border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", toneCls[tone], className)}>
      {children}
    </span>
  );
}

const btn = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-ink-2 hover:bg-surface-2",
};
export type ButtonVariant = keyof typeof btn;
export const buttonClass = (v: ButtonVariant = "primary", extra?: string) =>
  clsx(
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    btn[v],
    extra,
  );

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...p} />;
}

export function LinkButton({ variant = "primary", className, ...p }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...p} />;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3 text-sm">{back}</div>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
