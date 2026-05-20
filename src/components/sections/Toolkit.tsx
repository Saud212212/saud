"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Cog, FlaskConical, HardHat, Hammer, Ruler, Zap } from "lucide-react";
import { SectionTitle } from "./Stats";

const CATEGORIES = [
  {
    id: "structural",
    label: "إنشائية",
    icon: HardHat,
    tools: [
      "حاسبة العمود الخرساني (Interaction Diagram)",
      "حاسبة الكمرة (Shear + Moment)",
      "حاسبة الأساسات (Settlement + Bearing)",
      "حاسبة السقف (One-way, Two-way, Flat)",
      "حاسبة الزلازل (Response Spectrum)",
      "حاسبة الرياح (ASCE 7-22)"
    ]
  },
  {
    id: "mechanical",
    label: "ميكانيكية",
    icon: Cog,
    tools: [
      "حاسبة التروس (Spur, Helical, Bevel)",
      "حاسبة المحامل (Bearing Life — L10)",
      "حاسبة Column Buckling (Euler/Johnson)",
      "حاسبة الربيع (Spring Design)",
      "حاسبة Heat Exchanger Sizing",
      "حاسبة المضخات والضواغط"
    ]
  },
  {
    id: "electrical",
    label: "كهربائية",
    icon: Zap,
    tools: [
      "حاسبة سقوط الجهد (NEC/IEC)",
      "حاسبة قصر الدائرة (IEC 60909)",
      "حاسبة حماية المحرك (Coordination)",
      "حاسبة الإضاءة (Dialux Lite Web)",
      "حاسبة التأريض (Grounding)",
      "حاسبة الكوابل والقدرة"
    ]
  },
  {
    id: "chemical",
    label: "كيميائية",
    icon: FlaskConical,
    tools: [
      "حاسبة Stoichiometry",
      "حاسبة Heat Transfer",
      "حاسبة Pipe Flow (Darcy-Weisbach)",
      "حاسبة Vapor Pressure",
      "حاسبة Chemical Equilibrium",
      "حاسبة Reactor Design"
    ]
  },
  {
    id: "units",
    label: "محول الوحدات",
    icon: Ruler,
    tools: [
      "500+ وحدة هندسية",
      "كشف تلقائي من النص",
      "تحويل SI / Imperial / Metric / CGS",
      "Dimensional Analysis",
      "الوحدات المركبة (N·m, kWh...)",
      "الدقة المزدوجة"
    ]
  },
  {
    id: "general",
    label: "أدوات عامة",
    icon: Hammer,
    tools: [
      "محرر معادلات (LaTeX)",
      "OCR ذكي للجداول",
      "محول CAD (DWG ↔ DXF)",
      "Mermaid Diagrams",
      "Plotly تفاعلي",
      "PDF Generator"
    ]
  }
];

export function Toolkit() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const current = CATEGORIES.find((c) => c.id === active)!;
  const Icon = current.icon;

  return (
    <section id="toolkit" className="relative py-28">
      <div className="container-x">
        <SectionTitle
          eyebrow="Engineering Toolkit · 100+ أداة"
          title="ودّع البرامج الخارجية الثقيلة"
          subtitle="أدوات تفاعلية كاملة في المتصفح. حاسبات صغيرة دقيقة لتعقيدات الميدان، تعمل في أي مكان، بأي جهاز."
        />

        <div className="mx-auto mt-14 max-w-6xl">
          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
            {CATEGORIES.map((c) => {
              const Ic = c.icon;
              const isActive = active === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActive(c.id)}
                  className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "text-ink-950"
                      : "text-engineering-200 hover:text-gold-200"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="tab-bg"
                      className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-gold-50 via-gold-300 to-gold-500 shadow-gold-glow"
                      transition={{ type: "spring", duration: 0.4 }}
                    />
                  )}
                  <Ic className="h-4 w-4" />
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          {/* Panel */}
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6 grid gap-4 lg:grid-cols-3"
          >
            {current.tools.map((tool, i) => (
              <div
                key={tool}
                className="card-luxury flex items-start gap-3"
              >
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-engineering-700/30 text-gold-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-engineering-400">
                    Tool #{String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-engineering-50">
                    {tool}
                  </div>
                </div>
                <span className="grid h-7 min-w-[28px] place-items-center rounded-md border border-accent-green/30 bg-accent-green/10 px-2 font-mono text-[10px] text-accent-green">
                  LIVE
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
