import { StatGridSkeleton, ChartSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <StatGridSkeleton />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-border p-5 lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div className="rounded-xl border border-border p-5">
          <TableSkeleton rows={5} columns={2} />
        </div>
      </div>
    </div>
  );
}
