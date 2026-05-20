"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Database,
  FileText,
  GraduationCap,
  Languages,
  Library,
  PlayCircle,
  Sigma
} from "lucide-react";
import { SectionTitle } from "./Stats";

const VAULT_ITEMS = [
  {
    icon: Sigma,
    title: "15,000+ معادلة هندسية",
    desc: "مصنفة، موثقة، قابلة للنسخ بصيغة LaTeX، مع تطبيقات عملية وأمثلة تفاعلية."
  },
  {
    icon: Database,
    title: "2,500+ جدول تفاعلي",
    desc: "جداول قابلة للفلترة والحساب الفوري — مواصفات الفولاذ، خرسانة، تربة، مواد..."
  },
  {
    icon: FileText,
    title: "800+ معيار دولي",
    desc: "ASTM, ISO, ASME, ACI, AISC, Eurocode, BS, DIN, JIS, GB, SBC — مع ربط ذكي."
  },
  {
    icon: GraduationCap,
    title: "50,000+ مسألة محلولة",
    desc: "كل مسألة محققة من 3 مهندسين معتمدين، مع خطوات الحل الكاملة والبدائل."
  },
  {
    icon: Library,
    title: "10,000+ دراسة حالة",
    desc: "مشاريع حقيقية من مطارات وجسور ومحطات كهرباء — مع التحديات والحلول."
  },
  {
    icon: PlayCircle,
    title: "5,000+ فيديو تعليمي",
    desc: "محتوى مرئي عالي الجودة بترجمة عربية احترافية، من خبراء حقيقيين."
  },
  {
    icon: BookOpen,
    title: "200+ كتاب إلكتروني",
    desc: "مراجع هندسية كاملة، تفاعلية، قابلة للبحث الذكي والملاحظات الخاصة."
  },
  {
    icon: Languages,
    title: "500,000+ مصطلح هندسي",
    desc: "قاموس متخصص في 12 لغة — يفهم السياق، يقترح، ويترجم بدقة هندسية."
  }
];

export function Vault() {
  return (
    <section id="vault" className="relative overflow-hidden py-28">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[400px] bg-radial-blue opacity-50"
      />

      <div className="container-x">
        <SectionTitle
          eyebrow="Engineering Vault · المكتبة الذكية"
          title="أكبر قاعدة معرفة هندسية رقمية في العالم العربي"
          subtitle="ابحث بلغة طبيعية. مثال: «عمود خرساني M30 بارتفاع 3م، حمولة 1500 kN، منطقة زلزالية 2B» — وستحصل على المقطع، التسليح، فحص الانبعاج، والرسم التفصيلي."
        />

        {/* Semantic search demo */}
        <div className="mx-auto mt-12 max-w-4xl">
          <div className="glass-strong rounded-2xl p-2 shadow-luxury">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-ink-950/70 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-400/15 text-gold-300">
                <Sigma className="h-4 w-4" />
              </span>
              <input
                type="text"
                defaultValue="عمود خرساني M30 ارتفاع 3م حمل 1500 kN زلزالي 2B"
                className="flex-1 bg-transparent text-sm text-engineering-50 placeholder:text-engineering-400 focus:outline-none"
                dir="rtl"
              />
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-engineering-400 sm:inline">
                ⌘K
              </span>
              <button type="button" className="btn-gold text-xs">
                بحث دلالي
              </button>
            </div>

            <div className="mt-2 grid gap-2 px-2 pb-2">
              {[
                {
                  type: "معادلة",
                  badge: "ACI 318-19 §10.5",
                  title: "Pn = 0.80 [0.85·fc'·(Ag-Ast) + fy·Ast]",
                  desc: "حساب القدرة المحورية للعمود المربوط"
                },
                {
                  type: "جدول",
                  badge: "SBC 304 Table 7.3",
                  title: "متطلبات التسليح للأعمدة الإنشائية",
                  desc: "حد أدنى 1% · حد أعلى 8% · المسافات بين الأسياخ"
                },
                {
                  type: "دراسة حالة",
                  badge: "Riyadh Tower #248",
                  title: "أعمدة برج 45 طابقًا — التسليح المعتمد",
                  desc: "حلول واقعية مع التحقق الزلزالي الكامل"
                }
              ].map((r, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-gold-400/30 hover:bg-gold-400/[0.03]"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gold-300">
                    {r.type}
                  </span>
                  <span className="h-4 w-px bg-white/10" />
                  <span className="hidden font-mono text-[10px] text-engineering-300 sm:inline">
                    {r.badge}
                  </span>
                  <div className="ms-auto text-end">
                    <div className="font-mono text-sm font-bold text-engineering-50">
                      {r.title}
                    </div>
                    <div className="text-xs text-engineering-300">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VAULT_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.04 }}
                className="card-luxury"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-engineering-700 to-engineering-900 shadow-edge">
                  <Icon className="h-5 w-5 text-gold-300" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-engineering-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-engineering-200/75">
                  {item.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
