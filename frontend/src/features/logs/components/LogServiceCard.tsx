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
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function MiniSparkline({ logs, id }: { logs: LogEntry[]; id: string }) {
  const buckets = Array.from({ length: 12 }, () => 0);
  const now = Date.now();
  logs.forEach((log) => {
    const ageMinutes = Math.floor((now - new Date(log.createdAt).getTime()) / 60000);
    const index = 11 - Math.min(11, Math.max(0, Math.floor(ageMinutes / 10)));
    buckets[index] += log.level === 'error' ? 3 : log.level === 'warn' ? 2 : 1;
  });
  const max = Math.max(...buckets, 1);
  const color = logs.some((l) => l.level === 'error') ? '#ef4444' : logs.some((l) => l.level === 'warn') ? '#f59e0b' : '#3b76c9';
  const smoothed = buckets.map((value, index) => {
    const previous = buckets[Math.max(0, index - 1)];
    const next = buckets[Math.min(buckets.length - 1, index + 1)];
    return previous * 0.2 + value * 0.6 + next * 0.2;
  });
  const W = 96, H = 30, PAD_X = 2, PAD_Y = 4;
  const stepX = (W - PAD_X * 2) / (smoothed.length - 1);
  const points = smoothed.map((value, index) => {
    const x = PAD_X + index * stepX;
    const y = PAD_Y + (H - PAD_Y * 2) - (value / max) * (H - PAD_Y * 2);
    return { x, y: Math.max(PAD_Y, Math.min(H - PAD_Y, y)) };
  });
  const linePath = points.reduce((path, point, index, all) => {
    if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const previous = all[index - 1];
    const beforePrevious = all[Math.max(0, index - 2)];
    const next = all[Math.min(all.length - 1, index + 1)];
    const smoothing = 0.18;
    const cp1x = previous.x + (point.x - beforePrevious.x) * smoothing;
    const cp1y = previous.y + (point.y - beforePrevious.y) * smoothing;
    const cp2x = point.x - (next.x - previous.x) * smoothing;
    const cp2y = point.y - (next.y - previous.y) * smoothing;
    return `${path} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, '');
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L${W - PAD_X},${H - PAD_Y} L${PAD_X},${H - PAD_Y} Z`;
  const safeId = id.replace(/[^a-zA-Z0-9]/g, '-');
  const gradientId = `log-card-sparkline-fill-${safeId}`;
  const glowId = `log-card-sparkline-glow-${safeId}`;

  return (
    <svg className="h-7.5 w-24 overflow-visible" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="60%" stopColor={color} stopOpacity={0.08} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={glowId} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.24 0"
          />
        </filter>
      </defs>
      <line x1={PAD_X} y1={H / 2} x2={W - PAD_X} y2={H / 2} stroke="currentColor" strokeWidth="1" className="text-slate-100 dark:text-ui-border-dark/60" />
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" filter={`url(#${glowId})`} opacity="0.28" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r="2.4" fill="white" stroke={color} strokeWidth="1.6" className="dark:fill-bg-surface-dark" />
    </svg>
  );
}

export const LogServiceCard = memo(function LogServiceCard({ service, recentLogs = [], onClick }: LogServiceCardProps) {
  const { t } = useTranslation(['logs', 'common']);
  const levels = service.logLevelFilter ?? [];
  const isPaused = service.isActive === false;
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
          <h3 className="font-semibold text-base truncate text-slate-900 dark:text-white">{service.name}</h3>
          <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">
            {t('logs.card.recent', { count: recentLogs.length })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {isPaused && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                {t('common:common.pause')}
              </span>
            )}
            <StatusBadge status={service.status} />
          </div>
          <div className="text-primary">
            <MiniSparkline logs={recentLogs} id={service.id} />
          </div>
        </div>
      </div>

      {/* Level counts */}
      <div className="flex gap-2">
        {levelsOrder.map((level) => (
          <div key={level} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 text-sm uppercase font-medium text-slate-400 dark:text-text-dim-dark">
              <span className={`w-1.5 h-1.5 rounded-full ${levelDotStyle[level]}`} />
              <span>{level}</span>
            </div>
            <span className={`text-sm font-semibold tabular-nums ${levelCounts[level] > 0 ? (level === 'error' ? 'text-red-500' : level === 'warn' ? 'text-amber-500' : level === 'info' ? 'text-sky-500' : level === 'debug' ? 'text-violet-400' : 'text-slate-400') : 'text-slate-400 dark:text-text-dim-dark'}`}>
              {levelCounts[level]}
            </span>
          </div>
        ))}
      </div>

      {/* Recent log preview */}
      <div className="space-y-1.5 min-h-15">
        {recentLogs.slice(0, 3).map((log) => (
          <div key={log.id} className="grid grid-cols-[60px_8px_1fr] gap-2 items-center text-sm">
            <span className="text-slate-400 dark:text-text-dim-dark tabular-nums">{formatClock(log.createdAt)}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${levelDotStyle[log.level]}`} />
            <span className={`${log.level === 'error' ? 'text-red-500' : log.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-text-base-dark'} truncate`}>
              {log.message}
            </span>
          </div>
        ))}
        {recentLogs.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-text-dim-dark">
            <MaterialIcon name="hourglass_empty" className="text-base" />
            {t('logs.card.noRecent', { defaultValue: '최근 수신된 로그가 없습니다' })}
          </div>
        )}
      </div>

      {/* Footer: last activity (left) + level filter chips (right) */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-ui-border-dark/50">
        <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark min-w-0 truncate">
          <MaterialIcon name="schedule" className="text-sm" />
          {formatTimeAgo(latestLog?.createdAt)}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {allLevels ? (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
              ALL
            </span>
          ) : (
            levels.map((level) => (
              <span
                key={level}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${levelDotStyle[level]}`} />
                {level === 'warn' ? 'WARN' : level.toUpperCase()}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
