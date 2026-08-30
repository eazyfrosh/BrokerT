"use client";

import Link from "next/link";
import { PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PerformanceBadge } from "@/components/shared/performance-badge";
import { formatCurrency, formatPercent, formatQuantity } from "@/lib/format";
import type { HoldingValuation } from "@/lib/calculations/portfolio";

export function HoldingsTable({ holdings }: { holdings: HoldingValuation[] }) {
  const columns: DataTableColumn<HoldingValuation>[] = [
    {
      id: "asset",
      header: "Asset",
      sortValue: (row) => row.symbol,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-semibold">{row.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{row.name}</p>
        </div>
      ),
    },
    {
      id: "quantity",
      header: "Quantity",
      align: "right",
      sortValue: (row) => row.quantity,
      cell: (row) => <span className="tabular">{formatQuantity(row.quantity)}</span>,
    },
    {
      id: "averageCost",
      header: "Average price",
      align: "right",
      sortValue: (row) => row.averageCost,
      hideOnMobile: true,
      cell: (row) => <span className="tabular">{formatCurrency(row.averageCost)}</span>,
    },
    {
      id: "currentPrice",
      header: "Current price",
      align: "right",
      sortValue: (row) => row.currentPrice,
      cell: (row) => <span className="tabular">{formatCurrency(row.currentPrice)}</span>,
    },
    {
      id: "marketValue",
      header: "Market value",
      align: "right",
      sortValue: (row) => row.marketValue,
      cell: (row) => <span className="font-medium tabular">{formatCurrency(row.marketValue)}</span>,
    },
    {
      id: "dayPnl",
      header: "Today's P/L",
      align: "right",
      sortValue: (row) => row.dayPnl,
      hideOnMobile: true,
      cell: (row) => (
        <PerformanceBadge value={row.dayPnl} format="currency" size="sm" showIcon={false} />
      ),
    },
    {
      id: "totalPnl",
      header: "Total P/L",
      align: "right",
      sortValue: (row) => row.unrealizedPnl,
      cell: (row) => (
        <PerformanceBadge value={row.unrealizedPnl} format="currency" size="sm" showIcon={false} />
      ),
    },
    {
      id: "returnPercent",
      header: "Return",
      align: "right",
      sortValue: (row) => row.returnPercent,
      cell: (row) => <PerformanceBadge value={row.returnPercent} size="sm" />,
    },
    {
      id: "weight",
      header: "Weight",
      align: "right",
      sortValue: (row) => row.weight,
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular text-muted-foreground">
          {formatPercent(row.weight, { signed: false })}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={holdings}
      columns={columns}
      getRowId={(row) => row.symbol}
      initialSort={{ columnId: "marketValue", direction: "desc" }}
      pageSize={15}
      emptyTitle="No holdings yet"
      emptyDescription="Buy an instrument and it will appear here, valued at the current quote."
      emptyAction={
        <Button asChild size="sm">
          <Link href="/trade">
            <PieChart /> Place your first order
          </Link>
        </Button>
      }
    />
  );
}
