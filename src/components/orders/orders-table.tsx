"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { CancelOrderButton } from "./cancel-order-button";
import { formatCurrency, formatDateTime, formatQuantity, titleCase } from "@/lib/format";
import { isCancellable } from "@/lib/services/orders-shared";
import type { OrderWithAsset } from "@/lib/services/orders";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "working", label: "Working" },
  { value: "filled", label: "Filled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
];

function matchesFilter(order: OrderWithAsset, filter: string): boolean {
  switch (filter) {
    case "working":
      return order.status === "pending" || order.status === "submitted" || order.status === "partially_filled";
    case "filled":
      return order.status === "filled";
    case "cancelled":
      return order.status === "cancelled";
    case "rejected":
      return order.status === "rejected";
    default:
      return true;
  }
}

export function OrdersTable({ orders }: { orders: OrderWithAsset[] }) {
  const [filter, setFilter] = React.useState("all");

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((option) => [option.value, orders.filter((o) => matchesFilter(o, option.value)).length]),
      ),
    [orders],
  );

  const rows = React.useMemo(() => orders.filter((o) => matchesFilter(o, filter)), [orders, filter]);

  const columns: DataTableColumn<OrderWithAsset>[] = [
    {
      id: "reference",
      header: "Order",
      sortValue: (row) => row.reference,
      cell: (row) => (
        <Link href={`/orders/${row.id}`} className="font-mono text-xs font-medium hover:underline">
          {row.reference}
        </Link>
      ),
    },
    {
      id: "asset",
      header: "Asset",
      sortValue: (row) => row.assets?.symbol ?? "",
      cell: (row) => <span className="font-medium">{row.assets?.symbol ?? "—"}</span>,
    },
    {
      id: "side",
      header: "Side",
      sortValue: (row) => row.side,
      cell: (row) => (
        <span className={row.side === "buy" ? "text-gain" : "text-loss"}>{titleCase(row.side)}</span>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (row) => row.order_type,
      hideOnMobile: true,
      cell: (row) => <span className="text-muted-foreground">{titleCase(row.order_type)}</span>,
    },
    {
      id: "quantity",
      header: "Quantity",
      align: "right",
      sortValue: (row) => Number(row.quantity),
      cell: (row) => <span className="tabular">{formatQuantity(row.quantity)}</span>,
    },
    {
      id: "price",
      header: "Price",
      align: "right",
      sortValue: (row) => Number(row.average_fill_price ?? row.limit_price ?? row.estimated_price ?? 0),
      hideOnMobile: true,
      cell: (row) => (
        <span className="tabular">
          {formatCurrency(row.average_fill_price ?? row.limit_price ?? row.estimated_price)}
        </span>
      ),
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (row) =>
        Number(row.quantity) * Number(row.average_fill_price ?? row.estimated_price ?? 0),
      cell: (row) => (
        <span className="font-medium tabular">
          {formatCurrency(
            Number(row.quantity) * Number(row.average_fill_price ?? row.estimated_price ?? 0),
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "created",
      header: "Created",
      sortValue: (row) => new Date(row.created_at).getTime(),
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) =>
        isCancellable(row.status) ? (
          <CancelOrderButton orderId={row.id} reference={row.reference}>
            Cancel
          </CancelOrderButton>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/orders/${row.id}`}>View</Link>
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterTabs
        options={FILTERS.map((option) => ({ ...option, count: counts[option.value] }))}
        value={filter}
        onChange={setFilter}
        ariaLabel="Filter orders by status"
      />

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchAccessor={(row) =>
          `${row.reference} ${row.assets?.symbol ?? ""} ${row.side} ${row.order_type} ${row.status}`
        }
        searchPlaceholder="Search by reference, asset or status…"
        initialSort={{ columnId: "created", direction: "desc" }}
        pageSize={12}
        emptyTitle="No orders here"
        emptyDescription="Orders you place appear here with their live status."
        emptyAction={
          <Button asChild size="sm">
            <Link href="/trade">
              <ClipboardList /> Open the trading terminal
            </Link>
          </Button>
        }
      />
    </div>
  );
}
