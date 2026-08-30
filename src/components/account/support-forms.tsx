"use client";

import * as React from "react";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createSupportTicketAction, replyToTicketAction } from "@/lib/actions/support";
import type { ActionResult } from "@/lib/actions/result";

const CATEGORIES = ["General", "Account", "Trading", "Investments", "Vehicles", "Billing", "Security"];

export function NewTicketForm() {
  const [state, formAction] = useActionState<ActionResult<{ id: string; reference: string }> | null, FormData>(
    createSupportTicketAction,
    null,
  );
  const [category, setCategory] = React.useState("General");
  const [priority, setPriority] = React.useState("normal");
  const formRef = React.useRef<HTMLFormElement>(null);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state?.ok && state.message && <FormMessage variant="success">{state.message}</FormMessage>}
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}

      <FormField name="subject" label="Subject" error={fieldErrors?.subject} required>
        {(props) => <Input {...props} placeholder="What do you need help with?" required />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="category" label="Category">
          {(props) => (
            <>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="category" value={category} />
            </>
          )}
        </FormField>

        <FormField name="priority" label="Priority">
          {(props) => (
            <>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id={props.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="priority" value={priority} />
            </>
          )}
        </FormField>
      </div>

      <FormField name="message" label="Message" error={fieldErrors?.message} required>
        {(props) => (
          <Textarea {...props} rows={5} placeholder="Describe what happened and what you expected." required />
        )}
      </FormField>

      <SubmitButton pendingLabel="Opening ticket…">Open ticket</SubmitButton>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(replyToTicketAction, null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3" noValidate>
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}
      <input type="hidden" name="ticketId" value={ticketId} />

      <FormField name="body" label="Reply" error={state && !state.ok ? state.fieldErrors?.body : undefined}>
        {(props) => <Textarea {...props} rows={4} placeholder="Add to this conversation…" required />}
      </FormField>

      <SubmitButton pendingLabel="Sending…">Send reply</SubmitButton>
    </form>
  );
}
