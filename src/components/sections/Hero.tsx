"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Play,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40">
      {/* Decorative orbits */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-20 -z-10 h-[800px] w-[800px] -translate-x-1/2 rounded-full border border-gold-400/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-40 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full border border-engineering-400/10"
      />

      <div className="container-x">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/5 px-4 py-1.5 text-xs font-medium text-gold-200 backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-300" />
            </span>
            <span className="font-mono uppercase tracking-[0.2em]">
              Now Live · الإصدار الجديد
            </span>
            <span className="text-gold-300/70">|</span>
            <span>منصة الهندسة الأولى مدعومة بـ AI</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-8 text-balance font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-[88px]"
          >
            <span className="text-gradient-light">حيث تلتقي</span>{" "}
            <span className="text-gradient-gold">70 سنة</span>{" "}
            <span className="text-gradient-light">من الخبرة الهندسية</span>{" "}
            <br className="hidden md:block" />
            <span className="text-gradient-light">بـ</span>{" "}
            <span className="text-gradient-blue">دقة الذكاء الاصطناعي</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-relaxed text-engineering-100/80 sm:text-xl"
          >
            <span className="font-display font-bold text-gold-200">
              EngHub Pro
            </span>{" "}
            هي المنصة الهندسية الأولى عالميًا التي تجمع 8 خبراء عالميين في كيان
            واحد — تحلّ مشاكلك بدقة الجراح، تطبق معايير 47 دولة، وتعتمدها أفضل
            الشركات الهندسية في الشرق الأوسط.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link href="#solver" className="btn-gold w-full sm:w-auto">
              <Sparkles className="h-4 w-4" />
              <span>جرّب الحل الذكي مجانًا</span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link href="#workflow" className="btn-ghost w-full sm:w-auto">
              <Play className="h-4 w-4" />
              <span>شاهد كيف يعمل</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-engineering-200/70"
          >
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-accent-green" />
              <span>SOC 2 + ISO 27001</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="h-4 w-4 text-gold-300" />
              <span>دقة AI تتجاوز 95%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-accent-orange" />
              <span>أقل من 3 دقائق للحل</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono uppercase tracking-widest text-engineering-300">
                47 دولة · 12 تخصص · 800+ معيار
              </span>
            </div>
          </motion.div>
        </div>

        {/* Hero showcase — engineering control panel */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35 }}
          className="relative mx-auto mt-20 max-w-6xl"
        >
          {/* glow */}
          <div
            aria-hidden
            className="absolute inset-x-10 -bottom-10 -top-10 -z-10 rounded-[40px] bg-gradient-to-br from-engineering-700/40 via-gold-500/10 to-engineering-900/40 blur-3xl"
          />

          <div className="glass-strong rounded-3xl p-2 shadow-luxury">
            <div className="rounded-[20px] border border-white/5 bg-ink-950/70 p-3 sm:p-6">
              {/* window bar */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-accent-red/70" />
                  <span className="h-3 w-3 rounded-full bg-accent-amber/70" />
                  <span className="h-3 w-3 rounded-full bg-accent-green/70" />
                </div>
                <div className="hidden font-mono text-[10px] uppercase tracking-widest text-engineering-400 sm:block">
                  enghub.pro / engineering-solver / session-04F2A
                </div>
                <div className="font-mono text-[10px] text-engineering-400">
                  v15.0.3
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-5">
                {/* Left panel: input */}
                <div className="lg:col-span-2">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-engineering-100">
                        المشكلة الهندسية
                      </span>
                      <span className="chip border-engineering-400/20 bg-engineering-700/20 text-engineering-200">
                        إنشائي
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-engineering-100/90">
                      عمود خرساني{" "}
                      <span className="font-mono text-gold-200">M30</span>{" "}
                      بارتفاع{" "}
                      <span className="font-mono text-gold-200">3 م</span>،
                      حمولة محورية{" "}
                      <span className="font-mono text-gold-200">1500 kN</span>،
                      غطاء حماية{" "}
                      <span className="font-mono text-gold-200">40 مم</span>،
                      منطقة زلزالية{" "}
                      <span className="font-mono text-gold-200">2B</span>.
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { label: "fc'", value: "30 MPa" },
                        { label: "fy", value: "420 MPa" },
                        { label: "Pu", value: "1500 kN" }
                      ].map((kv) => (
                        <div
                          key={kv.label}
                          className="rounded-lg border border-white/5 bg-ink-900/60 p-2 text-center"
                        >
                          <div className="font-mono text-[10px] uppercase text-engineering-400">
                            {kv.label}
                          </div>
                          <div className="mt-0.5 font-mono text-sm font-bold text-engineering-50">
                            {kv.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-engineering-100">
                        المعايير المطبقة
                      </span>
                      <span className="font-mono text-[10px] text-engineering-400">
                        3 معايير
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { code: "ACI 318-19", section: "Chapter 10" },
                        { code: "SBC 304", section: "Section 7.3" },
                        { code: "Eurocode 2", section: "Clause 5.8" }
                      ].map((s) => (
                        <div
                          key={s.code}
                          className="flex items-center justify-between rounded-lg border border-white/5 bg-ink-900/60 px-3 py-2 text-xs"
                        >
                          <span className="font-mono font-bold text-gold-200">
                            {s.code}
                          </span>
                          <span className="text-engineering-300">
                            {s.section}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Center: Diagram */}
                <div className="lg:col-span-2">
                  <ColumnDiagram />
                </div>

                {/* Right: Results */}
                <div className="lg:col-span-1">
                  <div className="space-y-3">
                    {[
                      {
                        label: "المقطع المقترح",
                        value: "400 × 400 mm",
                        status: "ok"
                      },
                      {
                        label: "نسبة التسليح",
                        value: "1.85%",
                        status: "ok"
                      },
                      {
                        label: "حديد التسليح",
                        value: "8Ø20",
                        status: "ok"
                      },
                      {
                        label: "Pu/φPn",
                        value: "0.72",
                        status: "ok"
                      },
                      {
                        label: "عامل الأمان",
                        value: "1.39",
                        status: "ok"
                      }
                    ].map((r) => (
                      <div
                        key={r.label}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3"
                      >
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-engineering-400">
                            {r.label}
                          </div>
                          <div className="mt-0.5 font-mono text-sm font-bold text-engineering-50">
                            {r.value}
                          </div>
                        </div>
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-green/20 text-accent-green">
                          ✓
                        </span>
                      </div>
                    ))}
                    <div className="rounded-lg border border-gold-400/30 bg-gold-400/5 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-gold-300">
                        الحالة العامة
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-gold-100">
                        ✓ آمن — يحقق جميع المعايير
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ColumnDiagram() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-engineering-100">
          الرسم التفصيلي
        </span>
        <span className="font-mono text-[10px] text-engineering-400">
          SVG · Vector
        </span>
      </div>
      <div className="relative flex-1">
        <svg
          viewBox="0 0 280 320"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="concrete" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#15297A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0A2540" stopOpacity="0.7" />
            </linearGradient>
            <pattern
              id="hatch"
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* Top arrow load */}
          <g>
            <line x1="140" y1="10" x2="140" y2="35" stroke="#E0B73B" strokeWidth="2" />
            <polygon points="140,42 134,32 146,32" fill="#E0B73B" />
            <text
              x="155"
              y="28"
              fill="#E9C95F"
              fontSize="10"
              fontFamily="monospace"
            >
              Pu = 1500 kN
            </text>
          </g>

          {/* Column */}
          <rect
            x="80"
            y="50"
            width="120"
            height="220"
            fill="url(#concrete)"
            stroke="#4A6BD0"
            strokeWidth="1.5"
          />
          <rect x="80" y="50" width="120" height="220" fill="url(#hatch)" />

          {/* Rebar */}
          {[
            [98, 68],
            [140, 68],
            [182, 68],
            [98, 252],
            [140, 252],
            [182, 252],
            [98, 160],
            [182, 160]
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="4" fill="#E0B73B" />
              <circle cx={cx} cy={cy} r="6" stroke="#E0B73B" strokeWidth="0.5" fill="none" />
            </g>
          ))}

          {/* Stirrups */}
          {[80, 110, 140, 170, 200, 230, 260].map((y) => (
            <rect
              key={y}
              x="90"
              y={y - 2}
              width="100"
              height="4"
              rx="2"
              fill="none"
              stroke="#FF6B35"
              strokeWidth="1"
              opacity="0.8"
            />
          ))}

          {/* Dimensions */}
          <g stroke="#9CB1ED" strokeWidth="0.5" fill="#9CB1ED" fontSize="9" fontFamily="monospace">
            <line x1="80" y1="285" x2="200" y2="285" />
            <line x1="80" y1="280" x2="80" y2="290" />
            <line x1="200" y1="280" x2="200" y2="290" />
            <text x="125" y="300">400 mm</text>

            <line x1="220" y1="50" x2="220" y2="270" />
            <line x1="215" y1="50" x2="225" y2="50" />
            <line x1="215" y1="270" x2="225" y2="270" />
            <text x="230" y="165" transform="rotate(0)">
              3000
            </text>
            <text x="230" y="178">mm</text>
          </g>

          {/* Base */}
          <rect x="60" y="270" width="160" height="8" fill="#1E2640" />
          <g stroke="#4A6BD0" strokeWidth="1" opacity="0.5">
            {[70, 90, 110, 130, 150, 170, 190, 210].map((x) => (
              <line key={x} x1={x} y1="278" x2={x - 5} y2="285" />
            ))}
          </g>
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 text-engineering-300">
          <span className="h-2 w-2 rounded-full bg-gold-400" />
          الطولي
        </div>
        <div className="flex items-center gap-1.5 text-engineering-300">
          <span className="h-2 w-2 rounded-full bg-accent-orange" />
          العرضي
        </div>
        <div className="flex items-center gap-1.5 text-engineering-300">
          <span className="h-2 w-2 rounded-full bg-engineering-400" />
          الخرسانة
        </div>
      </div>
    </div>
  );
}
