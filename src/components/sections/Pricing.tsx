"use client";

import { motion } from "framer-motion";
import { Check, Crown, Rocket, Building2, Sparkles } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "./Stats";

const PLANS = [
  {
    id: "free",
    name: "المجاني",
    icon: Sparkles,
    price: "0",
    period: "للأبد",
    blurb: "للطلاب والمستكشفين",
    cta: "ابدأ مجانًا",
    highlight: false,
    features: [
      "10 حلول هندسية / شهر",
      "أدوات حاسبة أساسية (20)",
      "بحث في المكتبة الذكية",
      "منتدى عام",
      "تقارير PDF بحد أقصى 3 / شهر",
      "دعم المجتمع"
    ]
  },
  {
    id: "pro",
    name: "محترف",
    icon: Rocket,
    price: "29",
    period: "شهريًا · $",
    blurb: "للمهندسين العاملين",
    cta: "اشترك الآن",
    highlight: true,
    features: [
      "حلول هندسية غير محدودة",
      "100+ أداة احترافية",
      "مكتبة كاملة + Case Studies",
      "تقارير PDF بختم رقمي",
      "أولوية المراجعة البشرية (24h)",
      "تكامل مع AutoCAD, Revit, ETABS",
      "API محدود (1000 req/يوم)",
      "دعم بريدي خلال 24 ساعة"
    ]
  },
  {
    id: "team",
    name: "فريق",
    icon: Crown,
    price: "99",
    period: "شهريًا · $",
    blurb: "للمكاتب والشركات الصغيرة",
    cta: "اطلب عرضًا",
    highlight: false,
    features: [
      "كل ميزات Pro · للفريق",
      "10 مستخدمين",
      "مساحة عمل مشتركة + التحكم",
      "API كامل (50k req/يوم)",
      "تكامل مع Slack, Teams, Jira",
      "تدقيق المشاريع بالـ AI",
      "تقارير الفريق + التحليلات",
      "دعم مخصص (4 ساعات)"
    ]
  },
  {
    id: "enterprise",
    name: "مؤسسي",
    icon: Building2,
    price: "499",
    period: "شهريًا · $",
    blurb: "للمؤسسات والحكومات",
    cta: "تواصل معنا",
    highlight: false,
    features: [
      "كل ميزات Team",
      "مستخدمون غير محدودون",
      "نشر سحابي مخصص (Private VPC)",
      "نموذج AI مخصص للشركة",
      "تكامل مع SAP, Oracle, BIM 360",
      "SLA مضمون 99.99% Uptime",
      "On-premise اختياري",
      "مدير حساب + تدريب ميداني"
    ]
  }
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-28">
      <div className="container-x">
        <SectionTitle
          eyebrow="الباقات · بشفافية كاملة"
          title="باقة لكل مرحلة من حياتك المهنية"
          subtitle="ابدأ مجانًا. ارتقِ حين تشاء. ألغِ متى أردت. وكل شيء بضمان استرداد كامل خلال 30 يومًا."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className={`relative rounded-3xl p-px ${
                  plan.highlight
                    ? "bg-gradient-to-br from-gold-300 via-gold-500 to-gold-700"
                    : "bg-white/5"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-950 shadow-gold-glow">
                    الأكثر شعبية ★
                  </span>
                )}

                <div className="h-full rounded-3xl bg-ink-950/90 p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-engineering-700 to-engineering-900 text-gold-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    {plan.highlight && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-gold-300">
                        Best Value
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 font-display text-xl font-bold text-engineering-50">
                    {plan.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-engineering-300">
                    {plan.blurb}
                  </p>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-extrabold text-gradient-gold">
                      ${plan.price}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-engineering-300">
                      {plan.period}
                    </span>
                  </div>

                  <Link
                    href="#start"
                    className={`mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
                      plan.highlight
                        ? "btn-gold !w-full"
                        : "border border-white/10 bg-white/5 text-engineering-50 hover:border-gold-400/40 hover:bg-gold-400/5 hover:text-gold-200"
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-engineering-100/85"
                      >
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-green" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 text-center font-mono text-[11px] uppercase tracking-wider text-engineering-300">
          جميع الباقات تشمل: SOC 2 + ISO 27001 + PDPL + ضمان 30 يومًا
        </div>
      </div>
    </section>
  );
}
