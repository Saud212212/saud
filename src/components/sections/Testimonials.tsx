"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { SectionTitle } from "./Stats";

const QUOTES = [
  {
    text: "في 30 سنة عمل، لم أرَ منصة تجمع الدقة الميدانية والذكاء الاصطناعي بهذا الشكل. EngHub أصبحت المرجع الأول في مكتبي.",
    name: "د. م. ناصر الشهري",
    role: "رئيس مهندسين إنشائيين · شركة عمران",
    rating: 5
  },
  {
    text: "وفّرت علينا ساعات لا تحصى. تقارير PDF احترافية، تطابق مع SBC و ACI، ومراجعة بشرية حقيقية. لا يوجد منافس قريب.",
    name: "م. هاجر القحطاني",
    role: "مدير قسم التصميم · مكتب الرياض الهندسي",
    rating: 5
  },
  {
    text: "كطالب دكتوراه في PINNs، Engineering Vault أنقذني مرات لا تحصى. عمق المحتوى وجودته يتفوقان على معظم الجامعات.",
    name: "م. عبدالرحمن العبيدي",
    role: "PhD Candidate · KFUPM",
    rating: 5
  },
  {
    text: "أدرنا 14 مشروعًا كبرى من خلال المنصة. التكامل مع ETABS وRevit ممتاز. الـ API مرن وموثوق.",
    name: "م. ريم البلوي",
    role: "Project Director · مجموعة المعمار",
    rating: 5
  }
];

export function Testimonials() {
  return (
    <section className="relative py-28">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[400px] bg-radial-gold opacity-60"
      />

      <div className="container-x">
        <SectionTitle
          eyebrow="آراء النخبة"
          title="يثق بنا قادة الهندسة العربية"
          subtitle="من المكاتب الاستشارية الكبرى إلى الباحثين في أرقى الجامعات — يستخدمون EngHub Pro يوميًا."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="card-luxury relative"
            >
              <Quote className="absolute end-6 top-6 h-10 w-10 text-gold-400/15" />

              <div className="flex gap-0.5">
                {Array.from({ length: q.rating }).map((_, k) => (
                  <span key={k} className="text-gold-300">
                    ★
                  </span>
                ))}
              </div>

              <blockquote className="mt-4 text-base leading-relaxed text-engineering-50/90">
                «{q.text}»
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3 border-t border-white/5 pt-5">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-700 font-display text-sm font-bold text-ink-950">
                  {q.name.split(" ").slice(-1)[0].charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-engineering-50">
                    {q.name}
                  </div>
                  <div className="font-mono text-[11px] text-engineering-300">
                    {q.role}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
