/** شعار وثيق: ختم بزاوية مطوية وعلامة توثيق. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--brand)" />
      <path d="M10 8h9l4 4v12a0 0 0 0 1 0 0H10a0 0 0 0 1 0 0V8z" fill="none" stroke="var(--brand-ink)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19 8v4h4" fill="none" stroke="var(--brand-ink)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 17.5l2.4 2.4 4.6-4.8" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
