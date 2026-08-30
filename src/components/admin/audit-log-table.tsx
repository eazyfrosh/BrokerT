"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { formatDateTime, titleCase } from "@/lib/format";
import type { AuditLog } from "@/types/database";

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  const columns: DataTableColumn<AuditLog>[] = [
    {
      id: "created",
      header: "When",
      sortValue: (row) => new Date(row.created_at).getTime(),
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      id: "actor",
      header: "Administrator",
      sortValue: (row) => row.actor_email ?? "",
      cell: (row) => <span className="truncate text-sm">{row.actor_email ?? "System"}</span>,
    },
    {
      id: "action",
      header: "Action",
      sortValue: (row) => row.action,
      cell: (row) => (
        <Badge variant="secondary" className="font-mono text-[0.6875rem]">
          {row.action}
        </Badge>
      ),
    },
    {
      id: "entity",
      header: "Target",
      sortValue: (row) => row.entity_type,
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground">
          {titleCase(row.entity_type)}
          {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
        </span>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => <span className="line-clamp-2 text-sm">{row.description ?? "—"}</span>,
    },
    {
      id: "ip",
      header: "IP",
      hideOnMobile: true,
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.ip_address ?? "—"}</span>
      ),
    },
  ];

  return (
    <DataTable
      data={logs}
      columns={columns}
      getRowId={(row) => row.id}
      searchAccessor={(row) =>
        `${row.actor_email ?? ""} ${row.action} ${row.entity_type} ${row.description ?? ""}`
      }
      searchPlaceholder="Search by administrator, action or description…"
      initialSort={{ columnId: "created", direction: "desc" }}
      pageSize={20}
      emptyTitle="No audit entries yet"
      emptyDescription="Administrative changes are recorded here as they happen."
    />
  );
}
