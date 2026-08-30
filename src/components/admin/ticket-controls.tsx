"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { adminReplyToTicketAction, adminSetTicketStatusAction } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/result";
import type { SupportTicketStatus } from "@/types/database";

export function AdminTicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(adminReplyToTicketAction, null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3" noValidate>
      {state && !state.ok && <FormMessage variant="error">{state.error}</FormMessage>}
      <input type="hidden" name="ticketId" value={ticketId} />

      <div className="space-y-1.5">
        <Label htmlFor="admin-reply">Reply as support</Label>
        <Textarea
          id="admin-reply"
          name="body"
          rows={4}
          placeholder="Reply to the customer. Never ask for their password."
          required
        />
      </div>

      <SubmitButton pendingLabel="Sending…">Send reply</SubmitButton>
    </form>
  );
}

export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: string;
  status: SupportTicketStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="ticket-status">Status</Label>
      <Select
        value={status}
        disabled={pending}
        onValueChange={(value) =>
          startTransition(async () => {
            const result = await adminSetTicketStatusAction(ticketId, value as SupportTicketStatus);
            if (result.ok) {
              toast.success("Ticket updated");
              router.refresh();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        <SelectTrigger id="ticket-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="pending">Pending customer</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
