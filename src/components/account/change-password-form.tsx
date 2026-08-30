"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordStrength } from "@/components/shared/password-strength";
import { changePasswordAction } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/result";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  const [password, setPassword] = React.useState("");
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  // Clear the new-password field once the change is accepted.
  React.useEffect(() => {
    if (state?.ok) setPassword("");
  }, [state]);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <FormField
        name="currentPassword"
        label="Current password"
        error={fieldErrors?.currentPassword}
        hint="Required — we re-check it before accepting a new one."
        required
      >
        {(props) => <Input {...props} type="password" autoComplete="current-password" required />}
      </FormField>

      <FormField name="password" label="New password" error={fieldErrors?.password} required>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </FormField>

      <PasswordStrength value={password} />

      <FormField
        name="confirmPassword"
        label="Confirm new password"
        error={fieldErrors?.confirmPassword}
        required
      >
        {(props) => <Input {...props} type="password" autoComplete="new-password" required />}
      </FormField>

      <SubmitButton pendingLabel="Updating…">Change password</SubmitButton>
    </form>
  );
}
