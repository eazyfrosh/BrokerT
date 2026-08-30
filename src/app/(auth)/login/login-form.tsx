"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { loginAction } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/result";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(loginAction, null);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {notice && <FormMessage variant="success">{notice}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <input type="hidden" name="next" value={next ?? ""} />

      <FormField name="email" label="Email" error={fieldErrors?.email} required>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
          />
        )}
      </FormField>

      <FormField name="password" label="Password" error={fieldErrors?.password} required>
        {(props) => <Input {...props} type="password" autoComplete="current-password" required />}
      </FormField>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
          Forgot your password?
        </Link>
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
