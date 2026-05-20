import type { Metadata, Viewport } from "next";
import { Cairo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"]
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "EngHub Pro — The Engineering Oracle | منصة المهندس الذكية",
    template: "%s | EngHub Pro"
  },
  description:
    "70 سنة من الخبرة الهندسية + قوة الذكاء الاصطناعي. منصة هندسية فاخرة لحل المشاكل، المكتبة الذكية، الأدوات التفاعلية، والمجتمع المهني العالمي.",
  keywords: [
    "هندسة",
    "engineering",
    "AI engineering",
    "structural",
    "mechanical",
    "electrical",
    "civil",
    "EngHub",
    "Engineering Oracle"
  ],
  openGraph: {
    title: "EngHub Pro — The Engineering Oracle",
    description: "70 Years of Engineering Wisdom, Powered by AI Precision.",
    type: "website",
    locale: "ar_SA"
  },
  metadataBase: new URL("https://enghub.pro")
};

export const viewport: Viewport = {
  themeColor: "#05070D",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${inter.variable} ${cairo.variable} ${jetbrains.variable} dark`}
      suppressHydrationWarning
    >
      <body className="font-arabic">
        <div className="relative isolate min-h-screen">
          {/* Ambient background */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-hero-mesh"
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-grid-pattern bg-[size:48px_48px] opacity-30"
          />
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[600px] bg-radial-gold"
          />

          <Navbar />
          <main className="relative">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
