import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon, StatusBadge } from '../../../components/common';
import { IconHealthCheck } from '../../../components/icons/SidebarIcons';
import type { Service } from '../../../types/service';

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

  return (
    <div
      className={`bg-white dark:bg-bg-surface-dark border border-slate-300 dark:border-ui-border-dark rounded-xl p-5 transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
            <IconHealthCheck size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base truncate text-slate-900 dark:text-white">{service.name}</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {service.isActive === false && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              {tc('common.pause')}
            </span>
          )}
          <StatusBadge status={service.status} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark uppercase font-semibold tracking-wide">{t('평균 지연 시간')}</p>
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{service.latency}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark uppercase font-semibold tracking-wide">{t('가동률')}</p>
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{service.uptime}</p>
        </div>
      </div>

      {/* Footer badges */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-ui-border-dark/50">
        {service.type && (
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
            service.type === 'http'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
          }`}>
            {service.type.toUpperCase()}
          </span>
        )}
        {service.interval != null && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="schedule" className="text-xs" />
            {formatInterval(service.interval)}
          </span>
        )}
      </div>
    </div>
  );
});
