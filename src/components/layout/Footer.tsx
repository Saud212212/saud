import Link from "next/link";
import { Sparkles, Github, Twitter, Linkedin, Mail } from "lucide-react";

const FOOTER_LINKS = {
  المنصة: [
    { href: "/#solver", label: "حل المشاكل الذكي" },
    { href: "/#vault", label: "المكتبة الهندسية" },
    { href: "/#toolkit", label: "الأدوات الحية" },
    { href: "/#community", label: "المجتمع المهني" }
  ],
  التخصصات: [
    { href: "/#specializations", label: "المدني والإنشائي" },
    { href: "/#specializations", label: "الميكانيكي" },
    { href: "/#specializations", label: "الكهربائي" },
    { href: "/#specializations", label: "جميع التخصصات" }
  ],
  الشركة: [
    { href: "#about", label: "من نحن" },
    { href: "#pricing", label: "الباقات" },
    { href: "#careers", label: "وظائف" },
    { href: "#blog", label: "المدونة" }
  ],
  قانوني: [
    { href: "#privacy", label: "سياسة الخصوصية" },
    { href: "#terms", label: "شروط الاستخدام" },
    { href: "#disclaimer", label: "إخلاء المسؤولية الهندسية" },
    { href: "#security", label: "الأمان والامتثال" }
  ]
};

export function Footer() {
  return (
    <footer className="relative mt-32 border-t border-white/5 bg-ink-950/60">
      <div className="absolute inset-x-0 top-0 h-px gold-line" />
      <div className="container-x py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <div className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-engineering-900 via-engineering-700 to-ink-900 shadow-edge">
                <span className="absolute inset-0 bg-radial-gold opacity-70" />
                <Sparkles className="relative h-6 w-6 text-gold-300" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-extrabold tracking-tight">
                  <span className="text-gradient-gold">EngHub</span>{" "}
                  <span className="text-engineering-100">Pro</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-engineering-300">
                  The Engineering Oracle
                </span>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-engineering-200/70">
              70 سنة من الخبرة الهندسية البشرية + قوة الذكاء الاصطناعي المتخصص.
              منصة لا مثيل لها لـ 15 مليون مهندس عربي حول العالم.
            </p>

            <div className="mt-6 flex gap-3">
              {[
                { Icon: Twitter, href: "#" },
                { Icon: Linkedin, href: "#" },
                { Icon: Github, href: "#" },
                { Icon: Mail, href: "#" }
              ].map(({ Icon, href }, i) => (
                <Link
                  key={i}
                  href={href}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-engineering-100 transition-all hover:border-gold-400/40 hover:bg-gold-400/5 hover:text-gold-200"
                  aria-label="social link"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {Object.entries(FOOTER_LINKS).map(([section, items]) => (
              <div key={section}>
                <h4 className="text-sm font-bold text-gold-200">{section}</h4>
                <ul className="mt-4 space-y-3">
                  {items.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-engineering-200/70 transition-colors hover:text-engineering-50"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="divider-luxury my-10" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-engineering-300 sm:flex-row">
          <p>
            © {new Date().getFullYear()} EngHub Pro. كل الحقوق محفوظة.
            <span className="mx-2 text-gold-400">•</span>
            <span className="font-mono uppercase tracking-wider">
              Crafted with engineering precision
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-engineering-400">
            <span>SOC 2 Type II</span>
            <span className="text-gold-400">•</span>
            <span>ISO 27001</span>
            <span className="text-gold-400">•</span>
            <span>GDPR</span>
            <span className="text-gold-400">•</span>
            <span>PDPL</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
