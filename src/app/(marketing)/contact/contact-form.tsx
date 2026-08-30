"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { contactAction } from "@/lib/actions/support";
import type { ActionResult } from "@/lib/actions/result";

export function ContactForm({
  defaultName = "",
  defaultEmail = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(contactAction, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="Your name" error={fieldErrors?.name} required>
          {(props) => <Input {...props} defaultValue={defaultName} autoComplete="name" required />}
        </FormField>
        <FormField name="email" label="Email" error={fieldErrors?.email} required>
          {(props) => (
            <Input {...props} type="email" defaultValue={defaultEmail} autoComplete="email" required />
          )}
        </FormField>
      </div>

      <FormField name="subject" label="Subject" error={fieldErrors?.subject} required>
        {(props) => <Input {...props} placeholder="What is this about?" required />}
      </FormField>

      <FormField name="message" label="Message" error={fieldErrors?.message} required>
        {(props) => <Textarea {...props} rows={6} required />}
      </FormField>

      <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}
