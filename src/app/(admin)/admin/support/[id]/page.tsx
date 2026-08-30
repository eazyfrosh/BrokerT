import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AdminTicketReplyForm, TicketStatusSelect } from "@/components/admin/ticket-controls";
import { getAdminTicket } from "@/lib/services/admin";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ticket = await getAdminTicket(id);
  return { title: ticket ? `${ticket.subject} · Admin` : "Ticket · Admin" };
}

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();

  const ticket = await getAdminTicket(id);
  if (!ticket) notFound();

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/support">
          <ArrowLeft /> Support queue
        </Link>
      </Button>

      <PageHeader title={ticket.subject} description={`Opened ${formatDateTime(ticket.created_at)}`}>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="font-mono text-xs text-muted-foreground">{ticket.reference}</span>
          <StatusBadge status={ticket.status} />
          <Badge variant="secondary">{ticket.category}</Badge>
          <Badge variant="outline">{titleCase(ticket.priority)} priority</Badge>
          {ticket.profiles && (
            <Link
              href={`/admin/users/${ticket.profiles.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {ticket.profiles.email}
            </Link>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
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
                      {message.is_staff ? "Support team" : "Customer"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(message.created_at)}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{message.body}</p>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-4">
              <AdminTicketReplyForm ticketId={ticket.id} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TicketStatusSelect ticketId={ticket.id} status={ticket.status} />

            {ticket.profiles && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/users/${ticket.profiles.id}`}>Open customer profile</Link>
              </Button>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Never ask a customer for their password or any part of it. Status changes are recorded in
              the audit log.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
