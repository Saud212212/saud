"use client";

const LOGOS = [
  "ACI 318-19",
  "AISC 360",
  "Eurocode 2",
  "SBC 304",
  "ASME BPVC",
  "NEC 2023",
  "IEEE 519",
  "ISO 9001",
  "ASTM",
  "NFPA 101",
  "IBC",
  "API 650"
];

export function TrustBar() {
  return (
    <section className="relative border-y border-white/5 bg-ink-900/40 py-10">
      <div className="container-x">
        <div className="mb-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-engineering-300">
            تطبيق صارم لـ 800+ معيار دولي ومحلي
          </p>
        </div>

        <div className="marquee relative overflow-hidden">
          <div className="flex animate-scroll-x items-center gap-12">
            {[...LOGOS, ...LOGOS].map((logo, i) => (
              <div
                key={i}
                className="group flex items-center gap-3 whitespace-nowrap"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 font-mono text-[10px] font-bold text-gold-300 transition-colors group-hover:border-gold-400/40 group-hover:text-gold-200">
                  {logo.split(" ")[0].slice(0, 3)}
                </span>
                <span className="font-mono text-sm font-medium text-engineering-200/60 transition-colors group-hover:text-engineering-100">
                  {logo}
                </span>
                <span className="text-gold-400">·</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
