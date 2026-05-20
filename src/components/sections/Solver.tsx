"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Sparkles
} from "lucide-react";
import { SectionTitle } from "./Stats";

const SAMPLE_PROMPTS = [
  "احسب تسليح كمرة 6م، حمل موزع 25 kN/m، خرسانة M30",
  "صمم محرك تيار مستمر 5kW بكفاءة 92%",
  "تحقق من ثبات منحدر تربة بزاوية 35°، رطبة",
  "حدد سُمك جدار خزان أسطواني بضغط 8 bar"
];

type Step = {
  title: string;
  detail: string;
  status: "done" | "active" | "pending";
};

const INITIAL_STEPS: Step[] = [
  { title: "الاستقبال والتوثيق", detail: "OCR + NLP + Vision", status: "pending" },
  { title: "التحليل الهندسي", detail: "تحديد التخصص والمعايير", status: "pending" },
  { title: "الحساب والحل", detail: "Double Precision + FEA Lite", status: "pending" },
  { title: "التحقق المتقاطع", detail: "طريقتان مستقلتان", status: "pending" },
  { title: "توليد التقرير", detail: "PDF + LaTeX + QR", status: "pending" },
  { title: "مراجعة بشرية", detail: "مهندس معتمد", status: "pending" }
];

export function Solver() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [done, setDone] = useState(false);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setDone(false);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));

    for (let i = 0; i < INITIAL_STEPS.length; i++) {
      await wait(550 + Math.random() * 250);
      setSteps((prev) =>
        prev.map((s, idx) =>
          idx < i ? { ...s, status: "done" } : idx === i ? { ...s, status: "active" } : s
        )
      );
    }
    await wait(550);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
    setRunning(false);
    setDone(true);
  };

  return (
    <section id="solver" className="relative py-28">
      <div className="container-x">
        <SectionTitle
          eyebrow="Engineering Solver · القلب النابض"
          title="حل أي مشكلة هندسية بدقة الجراح وسرعة البرق"
          subtitle="ارفع نصًا، صورة، رسم CAD، PDF، أو ملف BIM. اختر التخصص. سيمر الحل عبر 7 مراحل هندسية صارمة قبل أن يصلك تقرير احترافي."
        />

        <div className="mx-auto mt-14 grid max-w-6xl gap-6 lg:grid-cols-12">
          {/* Input panel */}
          <div className="lg:col-span-7">
            <div className="glass-strong rounded-3xl p-2 shadow-luxury">
              <div className="rounded-[20px] border border-white/5 bg-ink-950/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-gold-300" />
                    <span className="text-sm font-bold">Engineering Solver</span>
                    <span className="chip">
                      <span className="font-mono text-[10px]">v2.4</span>
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-engineering-400">
                    تخصص تلقائي ✓
                  </span>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="مثال: عمود خرساني M30 بارتفاع 3م، حمولة محورية 1500 kN، منطقة زلزالية Zone 2B..."
                  className="min-h-[140px] w-full resize-none rounded-xl border border-white/10 bg-ink-900/60 p-4 text-sm text-engineering-50 placeholder:text-engineering-400 focus:border-gold-400/50 focus:outline-none focus:ring-2 focus:ring-gold-400/20"
                  dir="rtl"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-engineering-200 hover:border-gold-400/40 hover:text-gold-200"
                      aria-label="إرفاق ملف"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-engineering-200 hover:border-gold-400/40 hover:text-gold-200"
                      aria-label="رفع صورة"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-engineering-200 hover:border-gold-400/40 hover:text-gold-200"
                      aria-label="رفع PDF"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <span className="ms-2 hidden font-mono text-[10px] text-engineering-400 sm:inline">
                      DWG · IFC · STEP · XLSX · PDF
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={run}
                    disabled={running}
                    className="btn-gold text-sm disabled:opacity-60"
                  >
                    {running ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جاري التحليل...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>حلّ الآن</span>
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-5 border-t border-white/5 pt-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-engineering-400">
                    جرّب مثالاً
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPrompt(p)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-engineering-100 hover:border-gold-400/40 hover:text-gold-200"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Steps panel */}
          <div className="lg:col-span-5">
            <div className="glass-strong rounded-3xl p-2 shadow-luxury">
              <div className="rounded-[20px] border border-white/5 bg-ink-950/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold">المراحل الـ 7</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-engineering-400">
                    {done ? "✓ مكتمل" : running ? "نشط..." : "في الانتظار"}
                  </span>
                </div>

                <ul className="space-y-3">
                  {steps.map((s, i) => (
                    <li key={s.title}>
                      <motion.div
                        animate={{
                          backgroundColor:
                            s.status === "active"
                              ? "rgba(224,183,59,0.06)"
                              : "rgba(255,255,255,0.02)"
                        }}
                        className="flex items-start gap-3 rounded-xl border border-white/5 p-3"
                      >
                        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg">
                          {s.status === "done" ? (
                            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-green/20 text-accent-green">
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                          ) : s.status === "active" ? (
                            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-400/20 text-gold-300">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </span>
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 font-mono text-xs text-engineering-300">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-engineering-50">
                              {s.title}
                            </span>
                            {s.status === "active" && (
                              <span className="font-mono text-[10px] text-gold-300">
                                جارٍ...
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-engineering-400">
                            {s.detail}
                          </div>
                        </div>
                      </motion.div>
                    </li>
                  ))}
                </ul>

                {done && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 rounded-xl border border-accent-green/30 bg-accent-green/10 p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-accent-green">
                      <CheckCircle2 className="h-4 w-4" />
                      التحليل اكتمل — التقرير جاهز
                    </div>
                    <div className="mt-1 text-xs text-engineering-100/80">
                      تم توليد PDF احترافي مع جميع المعادلات بصيغة LaTeX،
                      الرسومات بـ SVG، وQR code للتحقق.
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="btn-gold text-xs">
                        تحميل التقرير
                      </button>
                      <button type="button" className="btn-ghost text-xs">
                        عرض الخطوات
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
