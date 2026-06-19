import { Skeleton } from './SkeletonBase';

export function KPICardSkeleton() {
  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
      <Skeleton className="h-4 w-24 mb-4" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
