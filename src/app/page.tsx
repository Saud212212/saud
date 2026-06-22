import Link from "next/link";
import { Activity, CalendarCheck, CreditCard, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/stripe/config";
import { formatCurrency } from "@/lib/utils";

const features = [
  { icon: Users, title: "Patient management", desc: "Files, medical history, allergies and timelines per clinic." },
  { icon: CalendarCheck, title: "Smart scheduling", desc: "Calendar booking with conflict detection and reminders." },
  { icon: CreditCard, title: "Billing & payments", desc: "Invoices, partial payments and Stripe checkout." },
  { icon: ShieldCheck, title: "Isolated & secure", desc: "Row-level security keeps every clinic's data separate." },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <Activity className="size-6 text-primary" />
          <span className="text-lg font-bold">ClinicOS</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <h1 className="text-balance text-5xl font-bold tracking-tight">
          Run your clinic, not your spreadsheets
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          ClinicOS is a multi-tenant clinic management platform — patients, appointments,
          medical records, invoicing and subscriptions, all in one place. Arabic & English ready.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#pricing">View pricing</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <f.icon className="size-8 text-primary" />
              <CardTitle className="mt-2 text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{f.desc}</CardContent>
          </Card>
        ))}
      </section>

      <section id="pricing" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold">Simple, transparent pricing</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <Card key={plan.tier} className={plan.tier === "pro" ? "border-primary shadow-md" : ""}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="text-3xl font-bold">
                    {formatCurrency(plan.priceMonthly)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feat) => (
                      <li key={feat}>• {feat}</li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6 w-full">
                    <Link href="/register">Choose {plan.name}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ClinicOS. Built with Next.js, Supabase & Stripe.
      </footer>
    </div>
  );
}
