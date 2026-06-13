import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon, StatusBadge } from '../../../components/common';
import { IconHealthCheck } from '../../../components/icons/SidebarIcons';
import { getUptimeTextClass, getUptimeTone, type UptimeTone } from '../../healthcheck/uptimeTone';
import type { Service } from '../../../types/service';

function SparklineArea({ data, tone, id }: { data: number[]; tone: UptimeTone; id: string }) {
  const color = tone === 'critical' ? '#ef4444' : tone === 'warning' ? '#f59e0b' : '#3b76c9';
  const safeId = id.replace(/[^a-zA-Z0-9]/g, '-');
  const gradientId = `sg-${safeId}`;
  const glowId = `sg-glow-${safeId}`;
  const W = 240, H = 42, PAD_X = 2, PAD_Y = 5;

  const smoothed = data.map((value, index) => {
    const previous = data[Math.max(0, index - 1)];
    const next = data[Math.min(data.length - 1, index + 1)];
    return previous * 0.2 + value * 0.6 + next * 0.2;
  });

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const visibleRange = range < 8 ? 8 : range;
  const center = (min + max) / 2;
  const chartMin = center - visibleRange / 2;
  const stepX = (W - PAD_X * 2) / (smoothed.length - 1);
  const toX = (i: number) => PAD_X + i * stepX;
  const toY = (v: number) => PAD_Y + (H - PAD_Y * 2) - ((v - chartMin) / visibleRange) * (H - PAD_Y * 2);
  const clampY = (y: number) => Math.max(PAD_Y, Math.min(H - PAD_Y, y));
  const points = smoothed.map((v, i) => ({ x: toX(i), y: clampY(toY(v)) }));
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

  const baselineY = H - PAD_Y;
  const midlineY = H / 2;
  const areaPts = `${linePath} L${W - PAD_X},${baselineY} L${PAD_X},${baselineY} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" style={{ height: 42 }} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.24} />
          <stop offset="58%" stopColor={color} stopOpacity={0.08} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={glowId} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.28 0"
          />
        </filter>
      </defs>
      <line x1={PAD_X} y1={midlineY} x2={W - PAD_X} y2={midlineY} stroke="currentColor" strokeWidth="1" className="text-slate-100 dark:text-ui-border-dark/60" />
      <path d={areaPts} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="3.8" strokeLinecap="round" filter={`url(#${glowId})`} opacity="0.3" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r="2.8" fill="white" stroke={color} strokeWidth="1.8" className="dark:fill-bg-surface-dark" />
    </svg>
  );
}

interface ServiceCardProps {
  service: Service;
  onClick?: () => void;
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

export const ServiceCard = memo(function ServiceCard({ service, onClick }: ServiceCardProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');

  const uptimeRaw = service.uptimeRaw ?? (Number.parseFloat(service.uptime) || 0);
  const uptimeTone = getUptimeTone(uptimeRaw);
  const uptimeTextClass = getUptimeTextClass(uptimeRaw);

  return (
    <div
      className={`relative bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
              <IconHealthCheck size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate text-slate-900 dark:text-white">{service.name}</h3>
              {service.url && (
                <p className="flex items-center gap-1 mt-px min-w-0">
                  <MaterialIcon name="link" className="text-sm text-slate-400 dark:text-text-dim-dark shrink-0" />
                  <span className="text-sm leading-snug font-mono text-slate-400 dark:text-text-dim-dark truncate">{service.url}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {service.isActive === false && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                {tc('common.pause')}
              </span>
            )}
            <StatusBadge status={service.status} />
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark uppercase font-medium tracking-wide">{t('평균 지연 시간')}</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{service.latency}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark uppercase font-medium tracking-wide">{t('가동률')}</p>
            <p className={`text-sm font-semibold tabular-nums ${uptimeTextClass}`}>{service.uptime}</p>
          </div>
        </div>

        {/* Full-width sparkline with gradient area */}
        {service.latencyHistory && service.latencyHistory.length >= 2 && (
          <SparklineArea data={service.latencyHistory} tone={uptimeTone} id={service.id} />
        )}

        {/* Footer: interval (left) + type badge (right) */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-ui-border-dark/50">
          <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark min-w-0 truncate">
            {service.interval != null ? (
              <>
                <MaterialIcon name="schedule" className="text-sm" />
                {formatInterval(service.interval)}
              </>
            ) : (
              <span>-</span>
            )}
          </span>
          {service.type && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase shrink-0 bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
              {service.type.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
