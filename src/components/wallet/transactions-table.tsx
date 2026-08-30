"use client";

import * as React from "react";
import { ScrollText } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types/database";

const GROUPS: { value: string; label: string; types: TransactionType[] | null }[] = [
  { value: "all", label: "All", types: null },
  { value: "deposits", label: "Deposits", types: ["deposit"] },
  { value: "withdrawals", label: "Withdrawals", types: ["withdrawal"] },
  { value: "trades", label: "Trades", types: ["buy", "sell"] },
  { value: "investments", label: "Investments", types: ["investment", "investment_return"] },
  { value: "fees", label: "Fees", types: ["fee", "refund"] },
];

export function TransactionsTable({
  transactions,
  initialFilter = "all",
}: {
  transactions: Transaction[];
  initialFilter?: string;
}) {
  const [filter, setFilter] = React.useState(initialFilter);

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

  const columns: DataTableColumn<Transaction>[] = [
    {
      id: "reference",
      header: "Reference",
      sortValue: (row) => row.reference,
      cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
    },
    {
      id: "type",
      header: "Type",
      sortValue: (row) => row.type,
      cell: (row) => <Badge variant="secondary">{titleCase(row.type)}</Badge>,
    },
    {
      id: "description",
      header: "Description",
      hideOnMobile: true,
      cell: (row) => (
        <span className="line-clamp-1 text-muted-foreground">{row.description ?? "—"}</span>
      ),
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
      id: "balance",
      header: "Balance after",
      align: "right",
      sortValue: (row) => Number(row.balance_after ?? 0),
      hideOnMobile: true,
      cell: (row) => <span className="tabular">{formatCurrency(row.balance_after)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
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
      <FilterTabs
        options={GROUPS.map((group) => ({
          value: group.value,
          label: group.label,
          count: counts[group.value],
        }))}
        value={filter}
        onChange={setFilter}
        ariaLabel="Filter transactions by type"
      />

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchAccessor={(row) => `${row.reference} ${row.type} ${row.description ?? ""} ${row.status}`}
        searchPlaceholder="Search by reference or description…"
        initialSort={{ columnId: "date", direction: "desc" }}
        pageSize={15}
        emptyTitle="No transactions here"
        emptyDescription="Trades, allocations, fees and cash movements all appear in this ledger."
      />

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ScrollText className="mt-px size-3.5 shrink-0" aria-hidden />
        Every entry carries a unique reference. Demo-mode entries are simulated and do not represent real
        money movement.
      </p>
    </div>
  );
}
