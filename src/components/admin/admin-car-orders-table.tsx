"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { adminUpdateCarOrderAction } from "@/lib/actions/admin";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type { CarOrderStatus } from "@/types/database";
import type { AdminCarOrderRow } from "@/lib/services/admin";

const STATUSES: CarOrderStatus[] = [
  "configuration",
  "order_request",
  "processing",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function matches(order: AdminCarOrderRow, filter: string): boolean {
  switch (filter) {
    case "open":
      return order.status !== "completed" && order.status !== "cancelled";
    case "completed":
    case "cancelled":
      return order.status === filter;
    default:
      return true;
  }
}

export function AdminCarOrdersTable({ orders }: { orders: AdminCarOrderRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState("all");
  const [editing, setEditing] = React.useState<AdminCarOrderRow | null>(null);
  const [status, setStatus] = React.useState<CarOrderStatus>("order_request");
  const [delivery, setDelivery] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((option) => [option.value, orders.filter((o) => matches(o, option.value)).length]),
      ),
    [orders],
  );

  const rows = React.useMemo(() => orders.filter((o) => matches(o, filter)), [orders, filter]);

  function openEditor(order: AdminCarOrderRow) {
    setEditing(order);
    setStatus(order.status);
    setDelivery(order.estimated_delivery ?? "");
    setNotes(order.internal_notes ?? "");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const result = await adminUpdateCarOrderAction({
      carOrderId: editing.id,
      status,
      estimatedDelivery: delivery,
      internalNotes: notes,
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Vehicle order updated", { description: editing.reference });
      setEditing(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const columns: DataTableColumn<AdminCarOrderRow>[] = [
    {
      id: "reference",
      header: "Request",
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
      id: "vehicle",
      header: "Vehicle",
      sortValue: (row) => row.vehicles?.model_name ?? "",
      cell: (row) => <span className="font-medium">{row.vehicles?.model_name ?? "—"}</span>,
    },
    {
      id: "total",
      header: "Total",
      align: "right",
      sortValue: (row) => Number(row.total_price),
      cell: (row) => (
        <span className="tabular">{formatCurrency(Number(row.total_price), { decimals: 0 })}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "delivery",
      header: "Delivery",
      sortValue: (row) => (row.estimated_delivery ? new Date(row.estimated_delivery).getTime() : 0),
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.estimated_delivery)}
        </span>
      ),
    },
    {
      id: "created",
      header: "Requested",
      sortValue: (row) => new Date(row.created_at).getTime(),
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openEditor(row)}>
          Manage
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
        ariaLabel="Filter vehicle order requests"
      />

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchAccessor={(row) =>
          `${row.reference} ${row.profiles?.email ?? ""} ${row.vehicles?.model_name ?? ""} ${row.status} ${row.configuration_summary ?? ""}`
        }
        searchPlaceholder="Search by reference, customer or vehicle…"
        initialSort={{ columnId: "created", direction: "desc" }}
        pageSize={15}
        emptyTitle="No vehicle requests match"
      />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !saving && !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Manage request {editing.reference}</DialogTitle>
                <DialogDescription>
                  Advancing the stage notifies the customer. Internal notes are never shown to them.
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border rounded-lg border border-border">
                {[
                  ["Customer", editing.profiles?.email ?? "—"],
                  ["Vehicle", editing.vehicles?.model_name ?? "—"],
                  ["Configuration", editing.configuration_summary ?? "—"],
                  ["Total", formatCurrency(Number(editing.total_price), { decimals: 0 })],
                  [
                    "Delivery address",
                    [
                      editing.delivery_address_line1,
                      editing.delivery_city,
                      editing.delivery_region,
                      editing.delivery_postal_code,
                      editing.delivery_country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="car-status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as CarOrderStatus)}>
                    <SelectTrigger id="car-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {titleCase(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="car-delivery">Estimated delivery</Label>
                  <Input
                    id="car-delivery"
                    type="date"
                    value={delivery}
                    onChange={(event) => setDelivery(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="car-notes">Internal notes</Label>
                <Textarea
                  id="car-notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Visible to staff only."
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button loading={saving} onClick={save}>
                  Save changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
