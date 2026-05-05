import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge, MaterialIcon } from '../../../components/common';
import { IconLogs } from '../../../components/icons/SidebarIcons';
import type { LogEntry, LogLevel, Service } from '../../../services/api';

interface LogServiceCardProps {
  service: Service;
  recentLogs?: LogEntry[];
  onClick?: () => void;
}

const levelBadgeStyle: Record<string, string> = {
  error: 'bg-red-500/10 text-red-500',
  warn:  'bg-amber-500/10 text-amber-500',
  info:  'bg-blue-500/10 text-blue-500',
  debug: 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
  trace: 'bg-slate-400/10 text-slate-500 dark:text-slate-400',
};

const levelCountStyle: Record<LogLevel, string> = {
  error: 'text-red-500',
  warn:  'text-amber-500',
  info:  'text-sky-500',
  debug: 'text-violet-400',
  trace: 'text-slate-400',
};

const levelDotStyle: Record<LogLevel, string> = {
  error: 'bg-red-500',
  warn: 'bg-amber-400',
  info: 'bg-sky-400',
  debug: 'bg-violet-400',
  trace: 'bg-slate-400',
};

const levelsOrder: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '-';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatClock(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function MiniSparkline({ logs }: { logs: LogEntry[] }) {
  const buckets = Array.from({ length: 12 }, () => 0);
  const now = Date.now();
  logs.forEach((log) => {
    const ageMinutes = Math.floor((now - new Date(log.createdAt).getTime()) / 60000);
    const index = 11 - Math.min(11, Math.max(0, Math.floor(ageMinutes / 10)));
    buckets[index] += log.level === 'error' ? 3 : log.level === 'warn' ? 2 : 1;
  });
  const max = Math.max(...buckets, 1);
  const points = buckets
    .map((value, index) => {
      const x = (index / (buckets.length - 1)) * 96;
      const y = 24 - (value / max) * 20;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="h-7 w-24 overflow-visible" viewBox="0 0 96 28" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={logs.some((l) => l.level === 'error') ? 'text-red-500' : logs.some((l) => l.level === 'warn') ? 'text-amber-500' : 'text-primary'}
      />
    </svg>
  );
}

export const LogServiceCard = memo(function LogServiceCard({ service, recentLogs = [], onClick }: LogServiceCardProps) {
  const { t } = useTranslation(['logs']);
  const levels = service.logLevelFilter ?? [];
  const allLevels = levels.length === 0 || levels.length === 5;
  const latestLog = recentLogs[0];
  const levelCounts = levelsOrder.reduce<Record<LogLevel, number>>((acc, level) => {
    acc[level] = recentLogs.filter((log) => log.level === level).length;
    return acc;
  }, { error: 0, warn: 0, info: 0, debug: 0, trace: 0 });

  return (
    <div
      className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 flex flex-col gap-3 transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Header: icon + name + status */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
          <IconLogs size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate text-slate-900 dark:text-white">{service.name}</h3>
          <p className="text-[11px] text-slate-400 dark:text-text-dim-dark truncate">{service.id}</p>
        </div>
        <StatusBadge status={service.status} />
      </div>

      {/* Stats row: count + last seen + sparkline */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-base font-black tabular-nums text-slate-900 dark:text-white">{recentLogs.length}</span>
          <span className="text-[11px] text-slate-400 dark:text-text-dim-dark">recent</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-text-muted-dark">
          <MaterialIcon name="schedule" className="text-sm" />
          {formatTimeAgo(latestLog?.createdAt)}
        </div>
        <div className="ml-auto text-primary">
          <MiniSparkline logs={recentLogs} />
        </div>
      </div>

      {/* Level counts */}
      <div className="grid grid-cols-5 gap-1.5">
        {levelsOrder.map((level) => (
          <div
            key={level}
            className={`flex flex-col items-center py-2 rounded-lg border border-slate-100 dark:border-ui-border-dark text-center transition-colors hover:bg-slate-50 dark:hover:bg-ui-hover-dark ${levelCounts[level] === 0 ? 'opacity-35' : ''}`}
          >
            <span className={`text-base font-black tabular-nums leading-none ${levelCounts[level] > 0 ? levelCountStyle[level] : 'text-slate-400 dark:text-text-dim-dark'}`}>
              {levelCounts[level]}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wide text-slate-400 dark:text-text-dim-dark mt-1">
              {level}
            </span>
          </div>
        ))}
      </div>

      {/* Recent log preview */}
      <div className="space-y-1.5 min-h-15">
        {recentLogs.slice(0, 3).map((log) => (
          <div key={log.id} className="grid grid-cols-[58px_10px_1fr] gap-2 items-baseline font-mono text-[11px]">
            <span className="text-slate-400 dark:text-text-dim-dark tabular-nums">{formatClock(log.createdAt)}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${levelDotStyle[log.level]}`} />
            <span className={`${log.level === 'error' ? 'text-red-500' : log.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-text-base-dark'} truncate`}>
              {log.message}
            </span>
          </div>
        ))}
        {recentLogs.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-text-dim-dark">
            <MaterialIcon name="hourglass_empty" className="text-base" />
            {t('logs.card.noRecent', { defaultValue: '최근 수신된 로그가 없습니다' })}
          </div>
        )}
      </div>

      {/* Footer: level filter chips + arrow */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-ui-border-dark/50">
        {allLevels ? (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
            ALL
          </span>
        ) : (
          levels.map((level) => (
            <span
              key={level}
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${levelBadgeStyle[level] ?? 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500'}`}
            >
              {level === 'warn' ? 'WARN' : level.toUpperCase()}
            </span>
          ))
        )}
        <MaterialIcon name="arrow_forward" className="ml-auto text-base text-slate-300 dark:text-text-dim-dark" />
      </div>
    </div>
  );
});
