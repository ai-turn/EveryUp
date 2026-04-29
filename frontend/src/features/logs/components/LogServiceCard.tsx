import { memo } from 'react';
import { StatusBadge } from '../../../components/common';
import { IconLogs } from '../../../components/icons/SidebarIcons';
import { Service } from '../../../services/api';

interface LogServiceCardProps {
  service: Service;
  onClick?: () => void;
}

const levelBadgeStyle: Record<string, string> = {
  error: 'bg-red-500/10 text-red-500',
  warn:  'bg-amber-500/10 text-amber-500',
  info:  'bg-blue-500/10 text-blue-500',
  debug: 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
  trace: 'bg-slate-400/10 text-slate-500 dark:text-slate-400',
};

export const LogServiceCard = memo(function LogServiceCard({ service, onClick }: LogServiceCardProps) {
  const levels = service.logLevelFilter ?? [];
  // length 0 = no filter set (server should never produce this post-migration);
  // length 5 = user explicitly enabled every level (incl. debug/trace).
  const allLevels = levels.length === 0 || levels.length === 5;

  return (
    <div
      className={`bg-white dark:bg-bg-surface-dark border border-slate-300 dark:border-ui-border-dark rounded-xl p-5 transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Header: icon + name + status badge */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
          <IconLogs size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate text-slate-900 dark:text-white">{service.name}</h3>
        </div>
        <StatusBadge status={service.status} />
      </div>

      {/* Log level filter badges */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-ui-border-dark/50">
        {allLevels ? (
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
            ALL
          </span>
        ) : (
          levels.map((level) => (
            <span
              key={level}
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${levelBadgeStyle[level] ?? 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500'}`}
            >
              {level === 'warn' ? 'WARN' : level.toUpperCase()}
            </span>
          ))
        )}
      </div>
    </div>
  );
});
