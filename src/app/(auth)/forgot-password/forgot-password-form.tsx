"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { forgotPasswordAction } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/result";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(forgotPasswordAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <FormField name="email" label="Email" error={fieldErrors?.email} required>
        {(props) => (
          <Input {...props} type="email" autoComplete="email" placeholder="you@example.com" required autoFocus />
        )}
      </FormField>

      <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
