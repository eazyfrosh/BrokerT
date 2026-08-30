"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { adminUpdateOrderStatusAction } from "@/lib/actions/admin";
import { formatCurrency, formatDateTime, formatQuantity, titleCase } from "@/lib/format";
import type { OrderStatus } from "@/types/database";
import type { AdminOrderRow } from "@/lib/services/admin";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "working", label: "Working" },
  { value: "filled", label: "Filled" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
];

function matches(order: AdminOrderRow, filter: string): boolean {
  switch (filter) {
    case "working":
      return ["pending", "submitted", "partially_filled"].includes(order.status);
    case "filled":
    case "cancelled":
    case "rejected":
      return order.status === filter;
    default:
      return true;
  }
}

export function AdminOrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<AdminOrderRow | null>(null);
  const [status, setStatus] = React.useState<OrderStatus>("filled");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((option) => [option.value, orders.filter((o) => matches(o, option.value)).length]),
      ),
    [orders],
  );

  const rows = React.useMemo(() => orders.filter((o) => matches(o, filter)), [orders, filter]);

  function openEditor(order: AdminOrderRow) {
    setEditing(order);
    setStatus(order.status);
    setReason(order.rejection_reason ?? "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const result = await adminUpdateOrderStatusAction({
      orderId: editing.id,
      status,
      reason,
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Order updated", { description: editing.reference });
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const columns: DataTableColumn<AdminOrderRow>[] = [
    {
      id: "reference",
      header: "Order",
      sortValue: (row) => row.reference,
      cell: (row) => <span className="font-mono text-xs font-medium">{row.reference}</span>,
    },
    {
      id: "customer",
      header: "Customer",
      sortValue: (row) => row.profiles?.email ?? "",
      cell: (row) =>
        row.profiles ? (
          <Link href={`/admin/users/${row.profiles.id}`} className="truncate text-sm hover:underline">
            {row.profiles.email}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "asset",
      header: "Asset",
      sortValue: (row) => row.assets?.symbol ?? "",
      hideOnMobile: true,
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
      id: "quantity",
      header: "Quantity",
      align: "right",
      sortValue: (row) => Number(row.quantity),
      hideOnMobile: true,
      cell: (row) => <span className="tabular">{formatQuantity(row.quantity)}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (row) =>
        Number(row.quantity) * Number(row.average_fill_price ?? row.estimated_price ?? 0),
      cell: (row) => (
        <span className="tabular">
          {formatCurrency(Number(row.quantity) * Number(row.average_fill_price ?? row.estimated_price ?? 0))}
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
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openEditor(row)}>
          Review
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
        ariaLabel="Filter orders"
      />

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchAccessor={(row) =>
          `${row.reference} ${row.profiles?.email ?? ""} ${row.assets?.symbol ?? ""} ${row.status}`
        }
        searchPlaceholder="Search by reference, customer or status…"
        initialSort={{ columnId: "created", direction: "desc" }}
        pageSize={15}
        emptyTitle="No orders match"
      />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !saving && !open && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Review order {editing.reference}</DialogTitle>
                <DialogDescription>
                  Changing an order status notifies the customer and is written to the audit log.
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border rounded-lg border border-border">
                {[
                  ["Customer", editing.profiles?.email ?? "—"],
                  ["Instrument", editing.assets?.symbol ?? "—"],
                  ["Side", titleCase(editing.side)],
                  ["Type", titleCase(editing.order_type)],
                  ["Quantity", formatQuantity(editing.quantity)],
                  ["Filled", formatQuantity(editing.filled_quantity)],
                  ["Average fill", formatCurrency(editing.average_fill_price)],
                  ["Created", formatDateTime(editing.created_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-1.5">
                <Label htmlFor="order-status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus)}>
                  <SelectTrigger id="order-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["pending", "submitted", "partially_filled", "filled", "cancelled", "rejected"].map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {titleCase(value)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              {status === "rejected" && (
                <div className="space-y-1.5">
                  <Label htmlFor="order-reason">Rejection reason (shown to the customer)</Label>
                  <Textarea
                    id="order-reason"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button loading={saving} onClick={save}>
                  Save status
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
