import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Car,
  ClipboardList,
  LifeBuoy,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SetupNotice } from "@/components/shared/setup-notice";
import { DemoModeAlert } from "@/components/shared/demo-notices";
import { ActivityChart } from "@/components/admin/activity-chart";
import { getAdminMetrics, getDailyCounts } from "@/lib/services/admin";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [metrics, users, orders, investments, carOrders] = await Promise.all([
    getAdminMetrics(),
    getDailyCounts("profiles", 30),
    getDailyCounts("orders", 30),
    getDailyCounts("investment_positions", 30),
    getDailyCounts("car_orders", 30),
  ]);

  const alerts = [
    { label: "Orders awaiting action", href: "/admin/orders", count: metrics?.pendingOrders ?? 0 },
    { label: "Vehicle requests in progress", href: "/admin/car-orders", count: metrics?.openCarOrders ?? 0 },
    { label: "Open support tickets", href: "/admin/support", count: metrics?.openTickets ?? 0 },
    { label: "Verifications pending", href: "/admin/kyc", count: metrics?.pendingKyc ?? 0 },
    { label: "Suspended accounts", href: "/admin/users", count: metrics?.suspendedUsers ?? 0 },
  ].filter((alert) => alert.count > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin dashboard"
        description="Platform activity across customers, trading, investing and vehicle requests."
      />

      <SetupNotice what="platform metrics" />
      <DemoModeAlert />

      <section aria-label="Customer metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value={formatNumber(metrics?.totalUsers ?? 0, 0)}
          icon={Users}
          accent="primary"
          hint={`${formatNumber(metrics?.activeUsers ?? 0, 0)} active`}
        />
        <StatCard
          label="New users (30 days)"
          value={formatNumber(metrics?.newUsers30d ?? 0, 0)}
          icon={UserPlus}
          hint={`${formatNumber(metrics?.newUsers7d ?? 0, 0)} in the last 7 days`}
        />
        <StatCard
          label="Orders"
          value={formatNumber(metrics?.totalOrders ?? 0, 0)}
          icon={ClipboardList}
          hint={`${formatNumber(metrics?.pendingOrders ?? 0, 0)} working · ${formatNumber(metrics?.filledOrders ?? 0, 0)} filled`}
        />
        <StatCard
          label="Vehicle requests"
          value={formatNumber(metrics?.carOrders ?? 0, 0)}
          icon={Car}
          hint={`${formatNumber(metrics?.openCarOrders ?? 0, 0)} in progress`}
        />
      </section>

      <section aria-label="Simulated value" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Simulated holdings value"
          value={formatCompactCurrency(metrics?.simulatedHoldingsValue ?? 0)}
          icon={TrendingUp}
          hint="Across all customer portfolios"
        />
        <StatCard
          label="Simulated cash"
          value={formatCompactCurrency(metrics?.simulatedCashBalance ?? 0)}
          icon={Wallet}
          hint="Available plus reserved"
        />
        <StatCard
          label="Simulated allocations"
          value={formatCompactCurrency(metrics?.simulatedInvestedValue ?? 0)}
          icon={BadgeCheck}
          hint="Open strategy positions"
        />
        <StatCard
          label="Fees recorded"
          value={formatCurrency(metrics?.simulatedFees ?? 0)}
          hint="Demo mode — not real revenue"
        />
      </section>

      {alerts.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {alerts.map((alert) => (
                <li key={alert.label}>
                  <Link
                    href={alert.href}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span>{alert.label}</span>
                    <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-semibold tabular text-warning">
                      {alert.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New users per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart points={users} color="var(--chart-1)" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart points={orders} color="var(--chart-4)" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocations per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart points={investments} color="var(--chart-6)" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle requests per day</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart points={carOrders} color="var(--chart-2)" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/admin/users", label: "Manage users", icon: Users },
          { href: "/admin/investments", label: "Manage strategies", icon: TrendingUp },
          { href: "/admin/support", label: "Support queue", icon: LifeBuoy },
          { href: "/admin/audit-logs", label: "Audit log", icon: ClipboardList },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Button key={action.href} asChild variant="outline" className="h-auto justify-start gap-3 p-4">
              <Link href={action.href}>
                <Icon className="size-4" />
                {action.label}
              </Link>
            </Button>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        All figures on this page are drawn from live database records. In demo mode those records
        describe simulated balances and simulated trading, not real assets under management or real
        revenue.
      </p>
    </div>
  );
}
