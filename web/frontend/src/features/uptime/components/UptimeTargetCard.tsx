import type { ReactNode } from 'react';
import { useTranslate } from '@tolgee/react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';

interface UptimeTargetCardProps {
  to: string;
  title: string;
  subtitle: string;
  status: ReactNode;
  endpoint: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function UptimeTargetCard({
  to, title, subtitle, status, endpoint, meta, actions,
}: UptimeTargetCardProps) {
  const { t } = useTranslate();

  return (
    <article className="group flex min-h-36 flex-col rounded-xl border border-ui-border bg-bg-surface transition-colors hover:border-primary/40 hover:bg-ui-hover-soft">
      <Link to={to} className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-text-base">{title}</h3>
            <p className="mt-1 truncate text-xs text-text-muted">{subtitle}</p>
          </div>
          {status}
        </div>
        <p className="truncate font-mono text-xs text-text-dim">{endpoint}</p>
        {meta}
        <span className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary">
          {t('상세 보기')}
          <MaterialIcon name="arrow_forward" className="text-sm transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
      {actions && <div className="flex gap-2 border-t border-ui-border px-4 py-3">{actions}</div>}
    </article>
  );
}
