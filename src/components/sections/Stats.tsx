"use client";

import { motion } from "framer-motion";

const STATS = [
  {
    value: "15,000+",
    label: "معادلة هندسية موثقة",
    sub: "مصنفة + بحث دلالي"
  },
  {
    value: "800+",
    label: "معيار تصميم دولي",
    sub: "ACI, ASME, ISO, Eurocode..."
  },
  {
    value: "50,000+",
    label: "مسألة محلولة ومُحققة",
    sub: "مراجعة بشرية + AI"
  },
  {
    value: "47",
    label: "دولة بمعاييرها المحلية",
    sub: "MENA, EU, US, Asia"
  },
  {
    value: "95%+",
    label: "دقة الحلول",
    sub: "مقارنة مع خبراء"
  },
  {
    value: "< 3min",
    label: "زمن الحل المتوسط",
    sub: "للمسائل المتوسطة"
  }
];

export function Stats() {
  return (
    <section className="relative py-24">
      <div className="container-x">
        <SectionTitle
          eyebrow="بالأرقام"
          title="حجم لا يضاهيه أحد في العالم العربي"
          subtitle="أكبر قاعدة معرفة هندسية رقمية، مدعومة بأقوى نماذج الذكاء الاصطناعي المتخصصة في STEM."
        />

        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative bg-ink-950/80 p-8 transition-colors hover:bg-ink-900/80"
            >
              <div className="absolute inset-0 bg-radial-gold opacity-0 transition-opacity duration-500 group-hover:opacity-20" />
              <div className="relative">
                <div className="font-display text-4xl font-extrabold text-gradient-gold sm:text-5xl">
                  {s.value}
                </div>
                <div className="mt-2 text-base font-semibold text-engineering-50">
                  {s.label}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-engineering-300">
                  {s.sub}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center"
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`mx-auto max-w-3xl ${
        align === "center" ? "text-center" : "text-start"
      }`}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-gold-200`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
        {eyebrow}
      </div>
      <h2 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl md:text-6xl">
        <span className="text-gradient-light">{title}</span>
      </h2>
      {subtitle && (
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-engineering-200/70 sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
