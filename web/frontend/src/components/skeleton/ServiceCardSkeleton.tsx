import { Skeleton } from './SkeletonBase';

export function ServiceCardSkeleton() {
  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Skeleton className="h-3 w-12 mb-1" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-12 mb-1" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>

      {/* Chart */}
      <Skeleton className="h-16 w-full rounded" />
    </div>
  );
}
