import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon, Sparkline, StatusBadge } from '../../../components/common';
import { IconHealthCheck } from '../../../components/icons/SidebarIcons';
import { getUptimeTextClass, getUptimeTone, type UptimeTone } from '../../healthcheck/uptimeTone';
import type { Service } from '../../../types/service';

interface ServiceCardProps {
  service: Service;
  onClick?: () => void;
}

function getSparklineColor(tone: UptimeTone) {
  if (tone === 'critical') return '#ef4444';
  if (tone === 'warning') return '#f59e0b';
  return '#3b82f6';
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
  const sparklineColor = getSparklineColor(uptimeTone);

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
          <Sparkline
            data={service.latencyHistory}
            width={240}
            height={42}
            color={sparklineColor}
            fluid
            className="mt-3 w-full"
          />
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
