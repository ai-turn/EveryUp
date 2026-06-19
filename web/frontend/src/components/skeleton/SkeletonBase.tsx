interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-ui-active-dark rounded ${className}`}
      style={{ width, height }}
    />
  );
}
