import { useTranslation } from 'react-i18next';
import { MaterialIcon, StatusBadge } from '../../../components/common';
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

export function ServiceCard({ service, onClick }: ServiceCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5 hover:border-primary/50 transition-colors ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
            <MaterialIcon name={service.icon} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">{service.name}</h3>
            <p className="text-xs text-slate-500 truncate">{service.cluster}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {service.isActive === false && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              {t('common.pause')}
            </span>
          )}
          <StatusBadge status={service.status} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold">{t('services.detail.metrics.responseTime')}</p>
          <p className="text-lg font-bold tabular-nums">{service.latency}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold">{t('services.detail.uptime')}</p>
          <p className="text-lg font-bold tabular-nums">{service.uptime}</p>
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
}
