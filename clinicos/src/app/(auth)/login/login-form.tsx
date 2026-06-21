"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * نموذج تسجيل الدخول (Client Component) باستخدام useActionState
 * المرتبط بـ Server Action المسؤول عن المصادقة والتحقق.
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={!!state?.errors?.email}
          required
        />
        {state?.errors?.email && (
          <p className="text-destructive text-sm">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          aria-invalid={!!state?.errors?.password}
          required
        />
        {state?.errors?.password && (
          <p className="text-destructive text-sm">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="text-destructive text-sm" role="alert">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "جارٍ تسجيل الدخول…" : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
