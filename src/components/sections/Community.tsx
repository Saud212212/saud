"use client";

import { motion } from "framer-motion";
import { Award, MessageSquare, ShieldCheck, Users2 } from "lucide-react";
import { SectionTitle } from "./Stats";

const FEATURES = [
  {
    icon: Award,
    title: "نظام السمعة الهندسية",
    desc: "نقاط مبنية على الجودة لا الكمية. شارات تخصصية معتمدة (خبير إنشائي، محلل FEA...). مراجعة 3 أقران لكل حل."
  },
  {
    icon: ShieldCheck,
    title: "التحقق من الهوية (KYC)",
    desc: "ربط مباشر مع أنظمة الترخيص: Saudi Council, Jordan Engineers, UAE Society, Egypt SEA — لتمييز المحترفين."
  },
  {
    icon: MessageSquare,
    title: "12 منتدى متخصص",
    desc: "50 موضوعًا فرعيًا لكل منتدى. وسوم متداخلة، بحث متقدم، تصنيف ذكي حسب الصعوبة والحالة."
  },
  {
    icon: Users2,
    title: "دردشة فورية ذكية",
    desc: "مشاركة شاشة مع رسم هندسي تفاعلي. مساعد AI داخل المحادثة يترجم ويحسب ويرسم في اللحظة."
  }
];

const MEMBERS = [
  { name: "م. خالد العتيبي", role: "خبير إنشائي · PE", reps: 12450, color: "engineering" },
  { name: "م. سارة عبدالله", role: "محلل FEA معتمد · PhD", reps: 9870, color: "gold" },
  { name: "م. عمر الحسيني", role: "كهربائي · MIET", reps: 8210, color: "engineering" },
  { name: "م. ليلى المنصور", role: "ميكاترونكس · MSc", reps: 7430, color: "gold" }
];

export function Community() {
  return (
    <section id="community" className="relative py-28">
      <div className="container-x">
        <SectionTitle
          eyebrow="Engineering Guild · المجتمع المهني"
          title="مجتمع نخبوي بمعايير الجودة الصارمة"
          subtitle="ليس مجرد منتدى أسئلة وأجوبة — بل تجمّع نخبة من المهندسين العرب المعتمدين، يتعلمون ويعلّمون ويتعاونون."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="card-luxury flex gap-5"
              >
                <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-engineering-700 to-engineering-900 text-gold-300 shadow-edge">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-engineering-50">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-engineering-200/75">
                    {f.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Top members showcase */}
        <div className="mt-10 rounded-3xl border border-white/5 bg-ink-950/50 p-2">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-gold-300">
                  مهندسو النخبة
                </div>
                <h3 className="mt-0.5 font-display text-xl font-bold">
                  Top Engineers هذا الأسبوع
                </h3>
              </div>
              <span className="chip">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
                12,450 عضو نشط
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {MEMBERS.map((m, i) => (
                <div
                  key={m.name}
                  className="group rounded-xl border border-white/5 bg-ink-900/60 p-4 transition-colors hover:border-gold-400/30"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-full font-display text-base font-bold ${
                        m.color === "gold"
                          ? "bg-gradient-to-br from-gold-400 to-gold-700 text-ink-950"
                          : "bg-gradient-to-br from-engineering-500 to-engineering-800 text-white"
                      }`}
                    >
                      {m.name.split(" ").slice(-1)[0].charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-engineering-50">
                        {m.name}
                      </div>
                      <div className="truncate font-mono text-[10px] text-engineering-300">
                        {m.role}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-gold-300">
                      ⭐ {m.reps.toLocaleString("en")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-engineering-400">
                      #{i + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
