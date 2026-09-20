"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { signInAction } from "@/app/admin/actions/auth";
import type { LoginState } from "@/app/admin/actions/auth";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <p role="alert" className="rounded-md border border-error/30 bg-error-bg p-3 text-sm font-semibold text-error">
          {state.error}
        </p>
      )}
      <Field label="البريد الإلكتروني" required>
        {(a) => <Input id={a.id} name="email" type="email" inputMode="email" autoComplete="username" dir="ltr" className="text-end" defaultValue={state.email ?? ""} key={state.email ?? "initial"} required />}
      </Field>
      <Field label="كلمة المرور" required>
        {(a) => <Input id={a.id} name="password" type="password" autoComplete="current-password" dir="ltr" className="text-end" required />}
      </Field>
      <Button type="submit" size="lg" disabled={pending} icon={<LogIn className="size-5" aria-hidden="true" />} className="mt-2 w-full">
        {pending ? "جاري الدخول…" : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
