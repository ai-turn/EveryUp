import { useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';

interface InfoChipProps {
  icon: string;
  label: string;
  value: string;
}

function InfoChip({ icon, label, value }: InfoChipProps) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark">
      <MaterialIcon name={icon} className="text-lg text-slate-500 dark:text-text-muted-dark" />
      <span className="text-sm text-slate-500 dark:text-text-muted-dark">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

export function AgentIdentity({ service }: { service: AgentServiceFlat }) {
  const { t } = useTranslate();
  const { t: tc, i18n } = useTranslation('common');

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language],
  );

  const status = service.healthy ? 'online' : 'offline';
  const statusConfig = {
    online: {
      bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
      text: 'text-emerald-500', dot: 'bg-emerald-500', ping: 'bg-emerald-400',
      labelKey: 'common.online',
    },
    offline: {
      bg: 'bg-red-500/10', border: 'border-red-500/20',
      text: 'text-red-500', dot: 'bg-red-500', ping: 'bg-red-400',
      labelKey: 'common.offline',
    },
  };
  const cfg = statusConfig[status];

  const lastCheckedText = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: dateLocale })
    : tc('common.never');

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{service.name}</h1>
        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${cfg.bg} border ${cfg.border}`}>
          <span className="relative flex h-2 w-2">
            {service.healthy && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ping} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
          </span>
          <span className={`${cfg.text} text-sm font-bold uppercase tracking-wider`}>
            {tc(cfg.labelKey)}
          </span>
        </div>
      </div>

      <p className="text-slate-500 dark:text-text-muted-dark text-sm mb-3">
        <span className="text-slate-400 dark:text-text-dim-dark mr-1">{t('엔드포인트')}:</span>
        <code className="break-all">{service.endpoint || '-'}</code>
      </p>

      <div className="flex flex-wrap gap-2">
        <InfoChip icon="language" label={t('타입')} value={service.checkType.toUpperCase()} />
        <InfoChip icon="sensors" label={t('에이전트')} value={service.agentName} />
        {service.lastLatency && (
          <InfoChip icon="speed" label={t('지연시간')} value={service.lastLatency} />
        )}
        <InfoChip icon="event" label={t('마지막 체크')} value={lastCheckedText} />
      </div>

      {!service.healthy && service.lastError && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-400">
          <span className="font-semibold">{t('오류')}: </span>
          {service.lastError}
        </div>
      )}
    </div>
  );
}
