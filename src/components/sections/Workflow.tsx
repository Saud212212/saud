"use client";

import { motion } from "framer-motion";
import {
  Upload,
  ScanText,
  Calculator,
  Shield,
  FileCheck2,
  Users,
  BrainCircuit
} from "lucide-react";
import { SectionTitle } from "./Stats";

const STAGES = [
  {
    icon: Upload,
    title: "الاستقبال والتوثيق",
    points: [
      "كشف تلقائي للتخصص",
      "OCR للمعادلات (LaTeX)",
      "تحويل الوحدات تلقائيًا",
      "سجل تدقيق كامل"
    ]
  },
  {
    icon: ScanText,
    title: "التحليل الهندسي العميق",
    points: [
      "فهم السياق والظروف",
      "تحديد المتغيرات",
      "استرجاع المعادلات (RAG)",
      "مطابقة المعايير"
    ]
  },
  {
    icon: Calculator,
    title: "الحساب والحل",
    points: [
      "Double Precision",
      "CODATA 2018 Constants",
      "FEA/CFD Lite",
      "Dimensional Analysis"
    ]
  },
  {
    icon: Shield,
    title: "التحقق المتقاطع",
    points: [
      "طريقة بديلة مستقلة",
      "فحص الحدود",
      "Safety Factor Check",
      "Uncertainty Quantification"
    ]
  },
  {
    icon: FileCheck2,
    title: "توليد التقرير الفاخر",
    points: [
      "PDF احترافي + QR",
      "LaTeX قابل للنسخ",
      "SVG vector graphics",
      "Engineering Disclaimer"
    ]
  },
  {
    icon: Users,
    title: "المراجعة البشرية",
    points: [
      "مهندس معتمد في التخصص",
      "نظام تصويت 3 مراجعين",
      "توقيع رقمي + Version",
      "SLA: 24h عادي · 4h طوارئ"
    ]
  },
  {
    icon: BrainCircuit,
    title: "التعلم والتحسين",
    points: [
      "تخزين في قاعدة المعرفة",
      "تحديث النماذج (Fine-tuning)",
      "توليد Case Studies",
      "تحديث فهرس المعايير"
    ]
  }
];

export function Workflow() {
  return (
    <section id="workflow" className="relative overflow-hidden py-28">
      <div className="container-x">
        <SectionTitle
          eyebrow="7 مراحل هندسية صارمة"
          title="كيف يصنع الحل الواحد رحلة من 7 محطات"
          subtitle="كل حل تخرجه المنصة يمر بسلسلة تحقق طبقية، تجمع منهجية الجراح الهندسي مع قوة الحوسبة الذكية الموزعة."
        />

        <div className="relative mt-16">
          <div
            aria-hidden
            className="absolute inset-y-0 start-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold-400/30 to-transparent lg:block"
          />

          <div className="space-y-6">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const isStart = i % 2 === 0;
              return (
                <motion.div
                  key={stage.title}
                  initial={{ opacity: 0, x: isStart ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5 }}
                  className={`grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] ${
                    isStart ? "" : "lg:[direction:rtl] lg:[&>*]:[direction:rtl]"
                  }`}
                >
                  <div className={isStart ? "lg:text-end" : ""}>
                    <div className="card-luxury">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gold-300">
                          المرحلة {i + 1}
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-l from-gold-400/30 to-transparent" />
                      </div>
                      <h3 className="mt-3 font-display text-xl font-bold text-engineering-50">
                        {stage.title}
                      </h3>
                      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-engineering-100/80">
                        {stage.points.map((p) => (
                          <li key={p} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-400" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="relative hidden lg:block">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl border border-gold-400/30 bg-gradient-to-br from-engineering-900 to-ink-900 shadow-gold-glow">
                      <Icon className="h-7 w-7 text-gold-300" />
                    </div>
                  </div>

                  <div className="lg:invisible">
                    <div className="lg:h-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
