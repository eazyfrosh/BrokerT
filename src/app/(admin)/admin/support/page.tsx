import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { StatusBadge } from "@/components/shared/status-badge";
import { listAllTickets } from "@/lib/services/admin";
import { formatDateTime, formatNumber, titleCase } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Support · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requireAdmin();
  const tickets = await listAllTickets();

  const open = tickets.filter((ticket) => ticket.status === "open");
  const pending = tickets.filter((ticket) => ticket.status === "pending");
  const urgent = tickets.filter(
    (ticket) => ticket.priority === "urgent" && ticket.status !== "closed" && ticket.status !== "resolved",
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Support" description="The customer support queue." />
      <SetupNotice what="support tickets" />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={formatNumber(open.length, 0)} accent="primary" />
        <StatCard label="Awaiting customer" value={formatNumber(pending.length, 0)} />
        <StatCard label="Urgent" value={formatNumber(urgent.length, 0)} accent="loss" />
        <StatCard label="Total" value={formatNumber(tickets.length, 0)} />
      </section>

      <Card>
        <CardContent className="p-4 sm:p-5">
          {tickets.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No tickets" description="The queue is empty." />
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/admin/support/${ticket.id}`}
                    className="-mx-2 flex flex-col gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ticket.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ticket.reference} · {ticket.profiles?.email ?? "—"} ·{" "}
                        {formatDateTime(ticket.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">{ticket.category}</Badge>
                      <Badge
                        variant={
                          ticket.priority === "urgent"
                            ? "destructive"
                            : ticket.priority === "high"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {titleCase(ticket.priority)}
                      </Badge>
                      <StatusBadge status={ticket.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
