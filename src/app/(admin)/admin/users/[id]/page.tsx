import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CopyButton } from "@/components/shared/copy-button";
import {
  SuspendUserButton,
  RoleSelect,
  KycSelect,
  StatusSelect,
} from "@/components/admin/user-actions";
import { getAdminUserDetail } from "@/lib/services/admin";
import { summarisePortfolio } from "@/lib/calculations/portfolio";
import { formatCurrency, formatDate, formatDateTime, formatQuantity, initialsOf, titleCase } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const detail = await getAdminUserDetail(id);
  return { title: detail ? `${detail.profile.email} · Admin` : "User · Admin" };
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();

  const detail = await getAdminUserDetail(id);
  if (!detail) notFound();

  const { profile, wallet, orders, transactions, carOrders, loginEvents, holdings, positions } = detail;
  const isSelf = profile.id === session.user.id;

  const summary = summarisePortfolio({
    holdings: holdings.map((holding) => ({
      symbol: holding.assets?.symbol ?? "—",
      name: holding.assets?.symbol ?? "—",
      quantity: Number(holding.quantity),
      averageCost: Number(holding.average_cost),
      currentPrice: Number(holding.assets?.market_quotes?.price ?? holding.average_cost),
      previousClose: Number(holding.assets?.market_quotes?.price ?? holding.average_cost),
    })),
    cashBalance: Number(wallet?.available_balance ?? 0),
    reservedBalance: Number(wallet?.reserved_balance ?? 0),
    investedValue: positions
      .filter((position) => position.status === "active")
      .reduce((sum, position) => sum + Number(position.current_value), 0),
    investedPrincipal: positions
      .filter((position) => position.status === "active")
      .reduce((sum, position) => sum + Number(position.principal), 0),
  });

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/users">
          <ArrowLeft /> All users
        </Link>
      </Button>

      <PageHeader
        title={[profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email}
        description={profile.email}
        actions={
          <>
            <CopyButton value={profile.id} label="Copy user id" />
            {!isSelf && (
              <SuspendUserButton
                userId={profile.id}
                email={profile.email}
                suspended={profile.account_status === "suspended"}
              />
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusBadge status={profile.account_status} />
          <StatusBadge status={profile.role} />
          <StatusBadge status={profile.kyc_status} />
          {isSelf && <span className="text-xs text-muted-foreground">This is your own account</span>}
        </div>
      </PageHeader>

      <section aria-label="Account value" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total value" value={formatCurrency(summary.totalValue)} accent="primary" />
        <StatCard label="Holdings" value={formatCurrency(summary.holdingsValue)} />
        <StatCard label="Cash" value={formatCurrency(summary.cashBalance)} />
        <StatCard label="Allocations" value={formatCurrency(summary.investedValue)} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <Tabs defaultValue="orders">
              <TabsList className="flex-wrap">
                <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
                <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
                <TabsTrigger value="positions">Allocations ({positions.length})</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles ({carOrders.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="orders">
                {orders.length === 0 ? (
                  <EmptyState title="No orders" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {orders.map((order) => (
                      <li key={order.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium capitalize">
                            {order.side} {formatQuantity(order.quantity)} {order.assets?.symbol}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {order.reference} · {formatDateTime(order.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={order.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="transactions">
                {transactions.length === 0 ? (
                  <EmptyState title="No transactions" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {transactions.map((transaction) => (
                      <li key={transaction.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{titleCase(transaction.type)}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {transaction.reference} · {formatDateTime(transaction.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm tabular">
                          {formatCurrency(Number(transaction.amount), { signed: true })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="positions">
                {positions.length === 0 ? (
                  <EmptyState title="No allocations" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {positions.map((position) => (
                      <li key={position.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {position.investments?.name ?? "Strategy"}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {position.reference}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm tabular">
                          {formatCurrency(Number(position.current_value))}
                        </span>
                        <StatusBadge status={position.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="vehicles">
                {carOrders.length === 0 ? (
                  <EmptyState title="No vehicle requests" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {carOrders.map((order) => (
                      <li key={order.id} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {order.vehicles?.model_name ?? "Vehicle"}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {order.reference} · {formatDate(order.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm tabular">
                          {formatCurrency(Number(order.total_price), { decimals: 0 })}
                        </span>
                        <StatusBadge status={order.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="activity">
                {loginEvents.length === 0 ? (
                  <EmptyState title="No sign-in activity recorded" compact />
                ) : (
                  <ul className="divide-y divide-border">
                    {loginEvents.map((event) => (
                      <li key={event.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{titleCase(event.event)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {event.ip_address ?? "IP not recorded"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(event.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                  <AvatarFallback>{initialsOf(profile.first_name, profile.last_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </div>

              <dl className="divide-y divide-border">
                {[
                  ["Phone", profile.phone ?? "—"],
                  ["Country", profile.country ?? "—"],
                  ["Joined", formatDate(profile.created_at)],
                  ["Last sign-in", profile.last_login_at ? formatDateTime(profile.last_login_at) : "Never"],
                  [
                    "Email verified",
                    profile.email_verified_at ? formatDate(profile.email_verified_at) : "No",
                  ],
                  ...(profile.suspension_reason
                    ? ([["Suspension reason", profile.suspension_reason]] as [string, string][])
                    : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {!isSelf && (
            <Card>
              <CardHeader>
                <CardTitle>Administration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusSelect userId={profile.id} status={profile.account_status} />
                <KycSelect userId={profile.id} status={profile.kyc_status} />
                <RoleSelect
                  userId={profile.id}
                  role={profile.role}
                  canEdit={session.profile.role === "super_admin"}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Every change here is written to the audit log with your identity, and the customer is
                  notified.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
