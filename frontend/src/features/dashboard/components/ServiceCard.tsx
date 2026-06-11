import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon, StatusBadge } from '../../../components/common';
import { IconHealthCheck } from '../../../components/icons/SidebarIcons';
import { getUptimeTextClass, getUptimeTone, type UptimeTone } from '../../healthcheck/uptimeTone';
import type { Service } from '../../../types/service';

function SparklineArea({ data, tone, id }: { data: number[]; tone: UptimeTone; id: string }) {
  const color = tone === 'critical' ? '#ef4444' : tone === 'warning' ? '#f59e0b' : '#3b76c9';
  const gradientId = `sg-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const W = 240, H = 38, PAD = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const toX = (i: number) => PAD + i * stepX;
  const toY = (v: number) => PAD + (H - PAD * 2) - ((v - min) / range) * (H - PAD * 2);
  const points = data.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const linePath = points.reduce((path, point, index) => {
    if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C${controlX.toFixed(1)},${previous.y.toFixed(1)} ${controlX.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, '');
  const lastPoint = points[points.length - 1];

  const areaPts = `${linePath} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" style={{ height: 38 }} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0.04} />
        </linearGradient>
      </defs>
      <path d={areaPts} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastPoint.x} cy={lastPoint.y} r="2.2" fill={color} opacity="0.85" />
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
              <h3 className="font-bold text-base truncate text-slate-900 dark:text-white">{service.name}</h3>
              {service.url && (
                <p className="flex items-center gap-1 mt-0.5 min-w-0">
                  <MaterialIcon name="link" className="text-xs text-slate-400 dark:text-text-dim-dark shrink-0" />
                  <span className="text-xs font-mono text-slate-400 dark:text-text-dim-dark truncate">{service.url}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {service.isActive === false && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                {tc('common.pause')}
              </span>
            )}
            <StatusBadge status={service.status} />
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark uppercase font-bold tracking-wide">{t('평균 지연 시간')}</p>
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{service.latency}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark uppercase font-bold tracking-wide">{t('가동률')}</p>
            <p className={`text-sm font-bold tabular-nums ${uptimeTextClass}`}>{service.uptime}</p>
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
                <MaterialIcon name="schedule" className="text-xs" />
                {formatInterval(service.interval)}
              </>
            ) : (
              <span>-</span>
            )}
          </span>
          {service.type && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
              {service.type.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
