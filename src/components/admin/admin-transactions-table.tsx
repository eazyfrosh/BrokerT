"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/database";
import type { AdminTransactionRow } from "@/lib/services/admin";

const GROUPS: { value: string; label: string; types: TransactionType[] | null }[] = [
  { value: "all", label: "All", types: null },
  { value: "deposits", label: "Deposits", types: ["deposit"] },
  { value: "withdrawals", label: "Withdrawals", types: ["withdrawal"] },
  { value: "trades", label: "Trades", types: ["buy", "sell"] },
  { value: "investments", label: "Investments", types: ["investment", "investment_return"] },
  { value: "fees", label: "Fees", types: ["fee", "refund"] },
];

export function AdminTransactionsTable({
  transactions,
  showFilters = true,
}: {
  transactions: AdminTransactionRow[];
  showFilters?: boolean;
}) {
  const [filter, setFilter] = React.useState("all");

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        GROUPS.map((group) => [
          group.value,
          group.types ? transactions.filter((t) => group.types!.includes(t.type)).length : transactions.length,
        ]),
      ),
    [transactions],
  );

  const rows = React.useMemo(() => {
    const group = GROUPS.find((item) => item.value === filter);
    if (!group?.types) return transactions;
    return transactions.filter((transaction) => group.types!.includes(transaction.type));
  }, [transactions, filter]);

  const columns: DataTableColumn<AdminTransactionRow>[] = [
    {
      id: "reference",
      header: "Reference",
      sortValue: (row) => row.reference,
      cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
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
      id: "type",
      header: "Type",
      sortValue: (row) => row.type,
      cell: (row) => <Badge variant="secondary">{titleCase(row.type)}</Badge>,
    },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (row) => Number(row.amount),
      cell: (row) => (
        <span
          className={cn(
            "font-medium tabular",
            Number(row.amount) > 0 && "text-gain",
            Number(row.amount) < 0 && "text-loss",
          )}
        >
          {formatCurrency(Number(row.amount), { signed: true })}
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
      id: "description",
      header: "Description",
      hideOnMobile: true,
      cell: (row) => <span className="line-clamp-1 text-muted-foreground">{row.description ?? "—"}</span>,
    },
    {
      id: "date",
      header: "Date",
      sortValue: (row) => new Date(row.created_at).getTime(),
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {showFilters && (
        <FilterTabs
          options={GROUPS.map((group) => ({
            value: group.value,
            label: group.label,
            count: counts[group.value],
          }))}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter transactions"
        />
      )}

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchAccessor={(row) =>
          `${row.reference} ${row.profiles?.email ?? ""} ${row.type} ${row.description ?? ""}`
        }
        searchPlaceholder="Search by reference, customer or description…"
        initialSort={{ columnId: "date", direction: "desc" }}
        pageSize={15}
        emptyTitle="No transactions match"
      />
    </div>
  );
}
