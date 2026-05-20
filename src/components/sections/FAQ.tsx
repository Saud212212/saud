"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionTitle } from "./Stats";

const QA = [
  {
    q: "هل المنصة دقيقة بما يكفي لاستخدامها في مشاريع حقيقية؟",
    a: "نعم. كل حل يمر بـ 7 مراحل تحقق صارمة، بما فيها التحقق المتقاطع باستخدام طرق بديلة ومراجعة بشرية إلزامية من مهندس معتمد في نفس التخصص. دقتنا تتجاوز 95% مقارنة بالحلول البشرية الخبيرة. ولكن كأي أداة هندسية، يبقى المهندس المسؤول هو من يصادق على القرار النهائي."
  },
  {
    q: "أي معايير دولية ومحلية تدعمها المنصة؟",
    a: "ندعم 800+ معيار بما فيها: ACI 318-19, AISC 360-16, Eurocode 2/3, BS 8110, SBC 304 (السعودي), SP 16 (الروسي), ASME BPVC, NEC 2023, IEC 60364, ISO 9001/14001/27001 — وأكثر بكثير. كل معيار محدّث بأحدث إصداراته، مع جدول مقارنة بين المعايير."
  },
  {
    q: "كيف تحمون بياناتنا الحساسة وملفات المشاريع؟",
    a: "أمان على مستوى البنية التحتية الحرجة: تشفير AES-256-GCM (للراحة) + TLS 1.3 + HSTS (للحركة). شهادات SOC 2 Type II وISO 27001. خوادم Multi-AZ مع نسخ احتياطي كل 5 دقائق. تدقيق ربع سنوي + Bug Bounty Program مفتوح. بياناتك ملكك، ولن نستخدمها لتدريب نماذج عامة."
  },
  {
    q: "هل يمكنني التكامل مع AutoCAD/Revit/ETABS؟",
    a: "نعم — تكامل أصلي مع AutoCAD, Revit, ETABS, SAP2000, SolidWorks, MATLAB. ندعم استيراد DWG, DXF, IFC, STEP, IGES, RVT. ولدينا Plugin مخصص يعمل داخل البرنامج مباشرة لباقات Team و Enterprise."
  },
  {
    q: "ماذا لو احتجت لحل عاجل خلال ساعات قليلة؟",
    a: "SLA الطوارئ في باقة Team و Enterprise يضمن مراجعة بشرية خلال 4 ساعات. لباقة Pro، الأولوية خلال 24 ساعة. الحل التلقائي بـ AI يكون جاهزًا خلال 3 دقائق في المتوسط."
  },
  {
    q: "هل تدعمون اللغة العربية بشكل احترافي؟",
    a: "EngHub Pro هي أول منصة مصممة من الصفر باللغة العربية الهندسية — وليست مجرد ترجمة. RTL كامل، خطوط هندسية محسّنة (Cairo, Tajawal, IBM Plex Arabic)، قاموس مصطلحات بـ 500,000+ كلمة، ودعم 47 لهجة وصياغة محلية."
  },
  {
    q: "هل أستطيع الإلغاء أو الترقية في أي وقت؟",
    a: "نعم، بدون رسوم خفية. ضمان استرداد كامل خلال 30 يومًا من أول اشتراك. يمكنك الترقية أو التخفيض بضغطة زر، والفروقات تُحسب بالـ Prorating تلقائيًا."
  }
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="relative py-28">
      <div className="container-x">
        <SectionTitle
          eyebrow="الأسئلة الشائعة"
          title="إجابات صريحة. بلا مبالغة."
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className={`overflow-hidden rounded-2xl border transition-colors ${
                  isOpen
                    ? "border-gold-400/30 bg-gold-400/[0.03]"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-engineering-50">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-gold-300 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-engineering-200/80">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
