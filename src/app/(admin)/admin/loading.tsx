import { StatGridSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <StatGridSkeleton />
      <div className="rounded-xl border border-border p-5">
        <TableSkeleton rows={8} columns={6} />
      </div>
    </div>
  );
}
