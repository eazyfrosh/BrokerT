import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TicketReplyForm } from "@/components/account/support-forms";
import { getMyTicket } from "@/lib/services/account";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ticket = await getMyTicket(id);
  return { title: ticket ? ticket.subject : "Ticket" };
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/support/${id}`);

  const ticket = await getMyTicket(id);
  if (!ticket) notFound();

  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/support">
          <ArrowLeft /> All tickets
        </Link>
      </Button>

      <PageHeader title={ticket.subject} description={`Opened ${formatDateTime(ticket.created_at)}`}>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="font-mono text-xs text-muted-foreground">{ticket.reference}</span>
          <StatusBadge status={ticket.status} />
          <Badge variant="secondary">{ticket.category}</Badge>
          <Badge variant="outline">{titleCase(ticket.priority)} priority</Badge>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-4">
            {ticket.support_messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  "rounded-xl border p-4",
                  message.is_staff ? "border-primary/25 bg-primary/5" : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold">
                    {message.is_staff ? "Support team" : "You"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(message.created_at)}</p>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{message.body}</p>
              </li>
            ))}
          </ul>

          {closed ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              This ticket is {ticket.status}. Open a new ticket if you still need help.
            </p>
          ) : (
            <div className="border-t border-border pt-4">
              <TicketReplyForm ticketId={ticket.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
