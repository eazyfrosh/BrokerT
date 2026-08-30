"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Pause, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { RiskMeter } from "@/components/shared/risk-meter";
import { adminSetInvestmentStatusAction } from "@/lib/actions/admin";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Investment } from "@/types/database";

export function AdminInvestmentsTable({ investments }: { investments: Investment[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function setStatus(id: string, status: "open" | "paused" | "archived", name: string) {
    startTransition(async () => {
      const result = await adminSetInvestmentStatusAction(id, status);
      if (result.ok) {
        toast.success(`"${name}" is now ${status}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const columns: DataTableColumn<Investment>[] = [
    {
      id: "name",
      header: "Strategy",
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/investments/${row.id}`} className="font-medium hover:underline">
            {row.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.category}</p>
        </div>
      ),
    },
    {
      id: "risk",
      header: "Risk",
      sortValue: (row) => row.risk_level,
      hideOnMobile: true,
      cell: (row) => <RiskMeter level={row.risk_level} showLabel={false} />,
    },
    {
      id: "target",
      header: "Target",
      align: "right",
      sortValue: (row) => Number(row.target_return_pct),
      cell: (row) => (
        <span className="tabular">{formatPercent(Number(row.target_return_pct), { signed: false })}</span>
      ),
    },
    {
      id: "term",
      header: "Term",
      align: "right",
      sortValue: (row) => row.duration_months,
      hideOnMobile: true,
      cell: (row) => <span className="tabular">{row.duration_months}m</span>,
    },
    {
      id: "minimum",
      header: "Minimum",
      align: "right",
      sortValue: (row) => Number(row.minimum_amount),
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular">{formatCurrency(Number(row.minimum_amount), { decimals: 0 })}</span>
      ),
    },
    {
      id: "raised",
      header: "Allocated",
      align: "right",
      sortValue: (row) => Number(row.raised_amount),
      cell: (row) => (
        <span className="tabular">{formatCurrency(Number(row.raised_amount), { decimals: 0 })}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${row.name}`}>
            <Link href={`/admin/investments/${row.id}`}>
              <Pencil />
            </Link>
          </Button>
          {row.status === "open" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Pause ${row.name}`}
              disabled={pending}
              onClick={() => setStatus(row.id, "paused", row.name)}
            >
              <Pause />
            </Button>
          ) : row.status !== "archived" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Open ${row.name}`}
              disabled={pending}
              onClick={() => setStatus(row.id, "open", row.name)}
            >
              <Play />
            </Button>
          ) : null}
          {row.status !== "archived" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Archive ${row.name}`}
              disabled={pending}
              onClick={() => setStatus(row.id, "archived", row.name)}
            >
              <Archive />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={investments}
      columns={columns}
      getRowId={(row) => row.id}
      searchAccessor={(row) => `${row.name} ${row.category} ${row.slug} ${row.status}`}
      searchPlaceholder="Search strategies…"
      initialSort={{ columnId: "name", direction: "asc" }}
      pageSize={15}
      emptyTitle="No strategies yet"
      emptyDescription="Create one to make it available to customers."
      emptyAction={
        <Button asChild size="sm">
          <Link href="/admin/investments/new">Create a strategy</Link>
        </Button>
      }
    />
  );
}
