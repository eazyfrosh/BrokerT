"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { PasswordStrength } from "@/components/shared/password-strength";
import { registerAction } from "@/lib/actions/auth";
import { COUNTRIES } from "@/lib/countries";
import type { ActionResult } from "@/lib/actions/result";

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(registerAction, null);
  const [password, setPassword] = React.useState("");
  const [country, setCountry] = React.useState("");

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="firstName" label="First name" error={fieldErrors?.firstName} required>
          {(props) => <Input {...props} autoComplete="given-name" required autoFocus />}
        </FormField>
        <FormField name="lastName" label="Last name" error={fieldErrors?.lastName} required>
          {(props) => <Input {...props} autoComplete="family-name" required />}
        </FormField>
      </div>

      <FormField name="email" label="Email" error={fieldErrors?.email} required>
        {(props) => (
          <Input {...props} type="email" autoComplete="email" placeholder="you@example.com" required />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="country" label="Country" error={fieldErrors?.country} required>
          {(props) => (
            <>
              <Select value={country} onValueChange={setCountry} name={props.name}>
                <SelectTrigger id={props.id} aria-invalid={props["aria-invalid"]} aria-describedby={props["aria-describedby"]}>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Radix Select is not a native control; mirror the value for the action. */}
              <input type="hidden" name="country" value={country} />
            </>
          )}
        </FormField>

        <FormField name="phone" label="Phone" error={fieldErrors?.phone} required>
          {(props) => <Input {...props} type="tel" autoComplete="tel" placeholder="+1 555 000 0000" required />}
        </FormField>
      </div>

      <FormField name="password" label="Password" error={fieldErrors?.password} required>
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </FormField>

      <PasswordStrength value={password} />

      <FormField
        name="confirmPassword"
        label="Confirm password"
        error={fieldErrors?.confirmPassword}
        required
      >
        {(props) => <Input {...props} type="password" autoComplete="new-password" required />}
      </FormField>

      <div className="flex items-start gap-2.5 pt-1">
        <Checkbox id="acceptTerms" name="acceptTerms" className="mt-0.5" />
        <Label htmlFor="acceptTerms" className="text-sm font-normal leading-relaxed text-muted-foreground">
          I have read and accept the{" "}
          <Link href="/terms" className="font-medium text-primary hover:underline">terms of service</Link>,{" "}
          <Link href="/privacy" className="font-medium text-primary hover:underline">privacy policy</Link> and{" "}
          <Link href="/risk-disclosure" className="font-medium text-primary hover:underline">risk disclosure</Link>,
          and I understand this platform is not affiliated with Tesla, Inc.
        </Label>
      </div>
      {fieldErrors?.acceptTerms && (
        <p className="text-xs font-medium text-destructive">{fieldErrors.acceptTerms}</p>
      )}

      <SubmitButton className="w-full" size="lg" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
