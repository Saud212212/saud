"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SPECIALIZATIONS } from "@/data/specializations";
import { SectionTitle } from "./Stats";

export function Specializations() {
  return (
    <section id="specializations" className="relative py-28">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px gold-line opacity-40"
      />

      <div className="container-x">
        <SectionTitle
          eyebrow="12 تخصصًا · مغطّاة بالكامل"
          title="منصة لكل المهندسين، من الطالب حتى الخبير"
          subtitle="كل تخصص مدعوم بمعاييره الدولية والمحلية، وأدواته الاحترافية، ومكتبته العميقة من المسائل المحلولة والمشاريع الفعلية."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPECIALIZATIONS.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.04 }}
              className="card-luxury group"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${s.color} text-2xl shadow-edge`}
                >
                  <span aria-hidden>{s.icon}</span>
                </div>
                <span className="chip">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                  <span className="font-mono">
                    {s.count.toLocaleString("en")}+
                  </span>
                </span>
              </div>

              <h3 className="mt-5 font-display text-xl font-bold text-engineering-50">
                {s.name}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-engineering-400">
                {s.english}
              </p>

              <div className="mt-5 space-y-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-gold-300">
                    المعايير
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.standards.slice(0, 3).map((std) => (
                      <span
                        key={std}
                        className="rounded-md border border-engineering-400/20 bg-engineering-700/20 px-2 py-0.5 font-mono text-[10px] text-engineering-100"
                      >
                        {std}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-gold-300">
                    الأدوات
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.tools.slice(0, 3).map((tool) => (
                      <span
                        key={tool}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-engineering-200"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <Link
                href={`/#${s.id}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <span>اكتشف الموارد</span>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
