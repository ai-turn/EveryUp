import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface UptimeTargetCardProps {
  to: string;
  title: string;
  subtitle: string;
  status: ReactNode;
  endpoint: string;
  meta?: ReactNode;
}

export function UptimeTargetCard({
  to, title, subtitle, status, endpoint, meta,
}: UptimeTargetCardProps) {
  return (
    // ponytail: stretched link — 카드 전체가 링크지만 상태 토글은 <a> 밖에 둔다
    <article className="card-interactive relative flex min-h-36 flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base text-text-base">
            <Link to={to} className="after:absolute after:inset-0 after:rounded-xl">{title}</Link>
          </h3>
          <p className="mt-1 truncate text-xs text-text-muted">{subtitle}</p>
        </div>
        <div className="relative">{status}</div>
      </div>
      <p className="truncate font-mono text-xs text-text-dim">{endpoint}</p>
      {meta}
    </article>
  );
}
