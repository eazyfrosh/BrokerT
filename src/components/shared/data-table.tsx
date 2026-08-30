"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  /** Hidden below the `md` breakpoint when true. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Fields concatenated for the search box. */
  searchAccessor?: (row: T) => string;
  searchPlaceholder?: string;
  initialSort?: { columnId: string; direction: "asc" | "desc" };
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  className?: string;
}

/**
 * Client-side sortable / searchable / paginated table.
 *
 * Suited to the page-sized result sets the app fetches (server-side filtering
 * narrows the set first); it never tries to hold an unbounded table in memory.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchAccessor,
  searchPlaceholder = "Search…",
  initialSort,
  pageSize = 10,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  emptyAction,
  onRowClick,
  toolbar,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState(initialSort);
  const [page, setPage] = React.useState(0);

  // Narrowing the result set should always land the reader on the first page.
  function search(value: string) {
    setQuery(value);
    setPage(0);
  }

  const filtered = React.useMemo(() => {
    if (!searchAccessor || !query.trim()) return data;
    const needle = query.trim().toLowerCase();
    return data.filter((row) => searchAccessor(row).toLowerCase().includes(needle));
  }, [data, query, searchAccessor]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return filtered;

    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(Math.ceil(sorted.length / pageSize), 1);
  const currentPage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function toggleSort(columnId: string) {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      return undefined;
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      {(searchAccessor || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {searchAccessor && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => search(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8.5"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title={query ? "No matches" : emptyTitle}
          description={query ? `Nothing matches “${query}”.` : emptyDescription}
          action={query ? undefined : emptyAction}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => {
                  const active = sort?.columnId === column.id;
                  return (
                    <TableHead
                      key={column.id}
                      className={cn(
                        column.align === "right" && "text-right",
                        column.align === "center" && "text-center",
                        column.hideOnMobile && "hidden md:table-cell",
                        column.headerClassName,
                      )}
                      aria-sort={active ? (sort!.direction === "asc" ? "ascending" : "descending") : undefined}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
                            active && "text-foreground",
                            column.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {column.header}
                          {active ? (
                            sort!.direction === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <span className="size-3" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.align === "right" && "text-right",
                        column.align === "center" && "text-center",
                        column.hideOnMobile && "hidden md:table-cell",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular">
            {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sorted.length)} of{" "}
            {sorted.length}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 text-xs text-muted-foreground tabular">
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
              disabled={currentPage >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
