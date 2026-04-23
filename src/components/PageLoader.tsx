import { Skeleton } from "@/components/ui/skeleton";

export default function PageLoader() {
  return (
    <div className="p-6 lg:p-10 max-w-7xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-8 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}