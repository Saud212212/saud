"use client";

import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export function CTA() {
  return (
    <section id="start" className="relative py-28">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[36px] border border-gold-400/20 p-px shadow-luxury"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold-400/20 via-engineering-700/10 to-engineering-900/20" />
          <div className="relative rounded-[36px] bg-ink-950/80 px-8 py-16 text-center sm:px-16 sm:py-20">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px gold-line"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px gold-line"
            />

            <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-gold-200">
              <Sparkles className="h-3.5 w-3.5" />
              <span>The Engineering Oracle ينتظرك</span>
            </div>

            <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl md:text-6xl">
              <span className="text-gradient-light">هذا ليس مجرد موقع.</span>{" "}
              <span className="text-gradient-gold">هذا هو المستقبل الهندسي.</span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-balance text-base text-engineering-200/80 sm:text-lg">
              انضم إلى آلاف المهندسين العرب الذين يبنون مستقبلهم المهني مع
              EngHub Pro. ابدأ اليوم — مجانًا — وبدون بطاقة ائتمان.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="#solver" className="btn-gold w-full sm:w-auto">
                <Sparkles className="h-4 w-4" />
                <span>ابدأ مجانًا الآن</span>
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link href="#pricing" className="btn-ghost w-full sm:w-auto">
                <span>قارن الباقات</span>
              </Link>
            </div>

            <div className="mt-8 grid gap-4 text-xs text-engineering-300 sm:grid-cols-3">
              <div>
                <div className="font-mono uppercase tracking-wider text-gold-300">
                  ✓ بدون بطاقة ائتمان
                </div>
              </div>
              <div>
                <div className="font-mono uppercase tracking-wider text-gold-300">
                  ✓ إلغاء فوري في أي وقت
                </div>
              </div>
              <div>
                <div className="font-mono uppercase tracking-wider text-gold-300">
                  ✓ ضمان 30 يومًا
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
