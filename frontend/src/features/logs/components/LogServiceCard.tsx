import { useTranslation } from 'react-i18next';
import { MaterialIcon, StatusBadge } from '../../../components/common';
import { IconLogs } from '../../../components/icons/SidebarIcons';
import { Service, LogEntry } from '../../../services/api';
import { relativeTime } from '../../../utils/formatters';

interface LogServiceCardProps {
  service: Service;
  latestLog?: LogEntry | null;
  onClick?: () => void;
}

const levelBadge: Record<string, string> = {
  error:   'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-blue-500 text-white',
};

export function LogServiceCard({ service, latestLog, onClick }: LogServiceCardProps) {
  const { t } = useTranslation(['logs', 'common']);

  return (
    <div
      className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5 transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0' : ''}`}
      onClick={onClick}
    >
      {/* Header: icon + name + status badge */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
          <IconLogs size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate text-slate-900 dark:text-white">{service.name}</h3>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{service.tags?.[0] || 'default'}</p>
        </div>
        <StatusBadge status={service.status} />
      </div>

      {/* Latest log row */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-ui-border-dark/50">
        {latestLog ? (
          <>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${levelBadge[latestLog.level] ?? 'bg-slate-400 text-white'}`}>
              {latestLog.level === 'warning' ? 'WARN' : latestLog.level.toUpperCase()}
            </span>
            <span className="text-xs text-slate-500 dark:text-text-muted-dark flex-1 truncate">
              {latestLog.message}
            </span>
            <span className="text-xs text-slate-400 dark:text-text-dim-dark shrink-0">
              {relativeTime(latestLog.createdAt)}
            </span>
          </>
        ) : latestLog === null ? (
          <span className="text-xs text-slate-400 dark:text-text-dim-dark italic">
            {t('logs.noLogs')}
          </span>
        ) : (
          <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
        )}
      </div>
    </div>
  );
}
