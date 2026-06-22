"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Registration creates a new clinic + its first clinic_admin. The clinic row
// needs the service role (RLS), so creation runs server-side in /api/auth/register.
export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ clinicName: "", fullName: "", email: "", password: "" });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(false);
      toast.error(data.error ?? "Registration failed");
      return;
    }

    // Auto sign-in the new admin.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setLoading(false);

    if (error) {
      toast.message("Clinic created — please sign in.");
      router.push("/login");
      return;
    }
    toast.success("Welcome to ClinicOS!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Activity className="mx-auto size-8 text-primary" />
          <CardTitle className="text-2xl">Create your clinic</CardTitle>
          <CardDescription>Start your 14-day free trial</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinicName">Clinic name</Label>
              <Input id="clinicName" required value={form.clinicName} onChange={set("clinicName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Your name</Label>
              <Input id="fullName" required value={form.fullName} onChange={set("fullName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create clinic"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
