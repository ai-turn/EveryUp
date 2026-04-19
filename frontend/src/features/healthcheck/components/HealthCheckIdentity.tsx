import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';

interface HealthCheckIdentityProps {
  name: string;
  endpoint: string;
  lastCheckedAt?: string;
  type: 'http' | 'tcp';
  status: 'online' | 'offline' | 'degraded';
  scheduleType?: 'interval' | 'cron';
  interval?: number;       // seconds
  timeout?: number;        // seconds
  cronExpression?: string;
}

function formatInterval(sec: number): string {
  if (sec >= 3600) return `${Math.round(sec / 3600)}hr`;
  if (sec >= 60)   return `${Math.round(sec / 60)}min`;
  return `${sec}s`;
}

interface InfoChipProps {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}

function InfoChip({ icon, label, value, accent }: InfoChipProps) {
  return (
    <div className="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark cursor-default">
      <MaterialIcon name={icon} className={`text-sm ${accent ? 'text-primary' : 'text-slate-400 dark:text-text-dim-dark'}`} />
      <span className="text-xs font-semibold text-slate-700 dark:text-text-base-dark">{value}</span>
      <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {label}
      </div>
    </div>
  );
}

export function HealthCheckIdentity({
  name,
  endpoint,
  lastCheckedAt,
  type,
  status,
  scheduleType,
  interval,
  timeout,
  cronExpression,
}: HealthCheckIdentityProps) {
  const { t } = useTranslate();
  const { t: tc, i18n } = useTranslation('common');

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language]
  );

  const statusConfig = {
    online: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      text: 'text-green-500',
      dot: 'bg-green-500',
      ping: 'bg-green-400',
      labelKey: 'common.online',
    },
    offline: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-500',
      dot: 'bg-red-500',
      ping: 'bg-red-400',
      labelKey: 'common.offline',
    },
    degraded: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      text: 'text-amber-500',
      dot: 'bg-amber-500',
      ping: 'bg-amber-400',
      labelKey: 'common.degraded',
    },
  };

  const config = statusConfig[status];

  const lastCheckedText = lastCheckedAt
    ? formatDistanceToNow(new Date(lastCheckedAt), { addSuffix: true, locale: dateLocale })
    : tc('common.never');

  const scheduleLabel = scheduleType === 'cron' && cronExpression
    ? cronExpression
    : interval
      ? formatInterval(interval)
      : '-';

  return (
    <div className="mb-8">
      <div className="min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{name}</h1>
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${config.bg} border ${config.border}`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.ping} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
            </span>
            <span className={`${config.text} text-xs font-bold uppercase tracking-wider`}>
              {tc(config.labelKey)}
            </span>
          </div>
        </div>

        {/* Endpoint */}
        <p className="text-slate-500 dark:text-text-muted-dark text-sm mb-3">
          <span className="text-slate-400 dark:text-text-dim-dark mr-1">{t('엔드포인트')}:</span>
          <code className="break-all">{endpoint}</code>
        </p>

        {/* Info chips */}
        <div className="flex flex-wrap gap-2">
          <InfoChip
            icon="language"
            label={t('타입')}
            value={type.toUpperCase()}
          />
          <InfoChip
            icon="sync"
            label={scheduleType === 'cron' ? 'CRON' : t('체크주기')}
            value={scheduleLabel}
          />
          {timeout != null && (
            <InfoChip
              icon="alarm"
              label={t('타임아웃')}
              value={`${timeout}s`}
            />
          )}
          <InfoChip
            icon="event"
            label={t('마지막 체크')}
            value={lastCheckedText}
          />
        </div>
      </div>
    </div>
  );
}
