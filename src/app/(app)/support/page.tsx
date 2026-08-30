import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { NewTicketForm } from "@/components/account/support-forms";
import { listMyTickets } from "@/lib/services/account";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { APP } from "@/lib/config";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  await requireSession("/support");
  const tickets = await listMyTickets();

  return (
    <div className="space-y-5">
      <PageHeader title="Support" description="Open a ticket and follow the conversation here." />

      <SetupNotice what="your tickets" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader>
            <CardTitle>Your tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <EmptyState
                icon={LifeBuoy}
                title="No tickets yet"
                description="Open one on the right and it will appear here with its status."
                compact
              />
            ) : (
              <ul className="divide-y divide-border">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/support/${ticket.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{ticket.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ticket.reference} · {ticket.category} · {titleCase(ticket.priority)} priority ·{" "}
                          {formatDateTime(ticket.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Open a ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <NewTicketForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other ways to reach us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Email{" "}
                <a href={`mailto:${APP.supportEmail}`} className="font-medium text-primary hover:underline">
                  {APP.supportEmail}
                </a>
              </p>
              <p className="text-xs leading-relaxed">
                Never share your password with anyone, including anyone claiming to be from {APP.name}. We
                will never ask for it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
