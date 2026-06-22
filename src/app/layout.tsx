import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ variable: "--font-sans-latin", subsets: ["latin"] });
const notoArabic = Noto_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"] });

export const metadata: Metadata = {
  title: "ClinicOS — Clinic Management SaaS",
  description: "Multi-tenant clinic management platform: patients, appointments, billing and more.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoArabic.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
