"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordStrength } from "@/components/shared/password-strength";
import { resetPasswordAction } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/result";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(resetPasswordAction, null);
  const [password, setPassword] = React.useState("");
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <FormField name="password" label="New password" error={fieldErrors?.password} required>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </FormField>

      <PasswordStrength value={password} />

      <FormField name="confirmPassword" label="Confirm new password" error={fieldErrors?.confirmPassword} required>
        {(props) => <Input {...props} type="password" autoComplete="new-password" required />}
      </FormField>

      <SubmitButton className="w-full" size="lg" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
