import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // المشروع معزول ضمن مستودع يضم مشروعاً آخر؛ نثبّت الجذر حتى لا يلتقط Turbopack ملفات المجلد الأب
  turbopack: { root: path.resolve(import.meta.dirname) },
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  // الحزم التي تعمل على الخادم فقط ولا تُجمَّع
  serverExternalPackages: ["pg", "pdfjs-dist"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
