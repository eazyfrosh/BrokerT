"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
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
import { updateProfileAction } from "@/lib/actions/profile";
import { COUNTRIES } from "@/lib/countries";
import type { ActionResult } from "@/lib/actions/result";
import type { Profile } from "@/types/database";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateProfileAction, null);
  const [country, setCountry] = React.useState(profile.country ?? "");
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="firstName" label="First name" error={fieldErrors?.firstName} required>
          {(props) => (
            <Input {...props} defaultValue={profile.first_name ?? ""} autoComplete="given-name" required />
          )}
        </FormField>
        <FormField name="lastName" label="Last name" error={fieldErrors?.lastName} required>
          {(props) => (
            <Input {...props} defaultValue={profile.last_name ?? ""} autoComplete="family-name" required />
          )}
        </FormField>
      </div>

      <FormField
        name="email"
        label="Email"
        hint="Your sign-in address. Contact support to change it."
      >
        {(props) => <Input {...props} type="email" value={profile.email} readOnly disabled />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="phone" label="Phone" error={fieldErrors?.phone}>
          {(props) => <Input {...props} type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />}
        </FormField>

        <FormField name="country" label="Country" error={fieldErrors?.country} required>
          {(props) => (
            <>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id={props.id} aria-invalid={props["aria-invalid"]}>
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
              <input type="hidden" name="country" value={country} />
            </>
          )}
        </FormField>
      </div>

      <FormField
        name="avatarUrl"
        label="Profile picture URL"
        error={fieldErrors?.avatarUrl}
        hint="Link to an image. Leave empty to use your initials."
      >
        {(props) => (
          <Input {...props} type="url" defaultValue={profile.avatar_url ?? ""} placeholder="https://…" />
        )}
      </FormField>

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
