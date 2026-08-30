"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { FilterTabs } from "@/components/shared/filter-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Profile } from "@/types/database";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "pending", label: "Pending" },
  { value: "admins", label: "Admins" },
];

function matches(profile: Profile, filter: string): boolean {
  switch (filter) {
    case "active":
    case "suspended":
    case "pending":
      return profile.account_status === filter;
    case "admins":
      return profile.role === "admin" || profile.role === "super_admin";
    default:
      return true;
  }
}

export function AdminUsersTable({ profiles }: { profiles: Profile[] }) {
  const [filter, setFilter] = React.useState("all");

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((option) => [option.value, profiles.filter((p) => matches(p, option.value)).length]),
      ),
    [profiles],
  );

  const rows = React.useMemo(() => profiles.filter((p) => matches(p, filter)), [profiles, filter]);

  const columns: DataTableColumn<Profile>[] = [
    {
      id: "name",
      header: "Customer",
      sortValue: (row) => `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email,
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/users/${row.id}`} className="font-medium hover:underline">
            {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      id: "country",
      header: "Country",
      sortValue: (row) => row.country ?? "",
      hideOnMobile: true,
      cell: (row) => <span className="text-muted-foreground">{row.country ?? "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.account_status,
      cell: (row) => <StatusBadge status={row.account_status} />,
    },
    {
      id: "role",
      header: "Role",
      sortValue: (row) => row.role,
      cell: (row) => <StatusBadge status={row.role} />,
    },
    {
      id: "kyc",
      header: "Verification",
      sortValue: (row) => row.kyc_status,
      hideOnMobile: true,
      cell: (row) => <StatusBadge status={row.kyc_status} />,
    },
    {
      id: "created",
      header: "Joined",
      sortValue: (row) => new Date(row.created_at).getTime(),
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
      ),
    },
    {
      id: "lastLogin",
      header: "Last sign-in",
      sortValue: (row) => (row.last_login_at ? new Date(row.last_login_at).getTime() : 0),
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.last_login_at ? formatDateTime(row.last_login_at) : "Never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/users/${row.id}`}>View</Link>
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
        ariaLabel="Filter users"
      />
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchAccessor={(row) =>
          `${row.email} ${row.first_name ?? ""} ${row.last_name ?? ""} ${row.country ?? ""} ${row.role}`
        }
        searchPlaceholder="Search by name, email or country…"
        initialSort={{ columnId: "created", direction: "desc" }}
        pageSize={15}
        emptyTitle="No users match"
      />
    </div>
  );
}
