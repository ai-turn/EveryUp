import { useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';
import { runtimeLabel } from '../runtimeLabels';

interface InfoChipProps {
  icon: string;
  label: string;
  value: string;
}

function InfoChip({ icon, label, value }: InfoChipProps) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-surface border border-ui-border">
      <MaterialIcon name={icon} className="text-lg text-text-muted" />
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-semibold text-text-base">{value}</span>
    </div>
  );
}

// showName=false hides the service name + status badge — used where the surrounding
// layout (e.g. the project sidebar/rail) already shows them, to avoid duplication.
export function AgentIdentity({ service, showName = true }: { service: AgentServiceFlat; showName?: boolean }) {
  const { t } = useTranslate();
  const { t: tc, i18n } = useTranslation('common');

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language],
  );

  // red = 장애(unhealthy); offline(수집 중단)은 slate — 색/어휘 매핑 규칙 준수
  const status = service.healthy ? 'healthy' : 'unhealthy';
  const statusConfig = {
    healthy: {
      bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
      text: 'text-emerald-500', dot: 'bg-emerald-500', ping: 'bg-emerald-400',
      label: t('정상'),
    },
    unhealthy: {
      bg: 'bg-red-500/10', border: 'border-red-500/20',
      text: 'text-red-500', dot: 'bg-red-500', ping: 'bg-red-400',
      label: t('장애'),
    },
  };
  const cfg = statusConfig[status];

  const lastCheckedText = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: dateLocale })
    : tc('common.never');

  return (
    <div className="mb-8">
      {showName && (
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-base">{service.name}</h1>
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${cfg.bg} border ${cfg.border}`}>
            <span className="relative flex h-2 w-2">
              {service.healthy && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.ping} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
            </span>
            <span className={`${cfg.text} text-sm font-bold uppercase tracking-wider`}>
              {cfg.label}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <InfoChip icon="language" label={t('타입')} value={service.checkType.toUpperCase()} />
        {service.runtime && <InfoChip icon="code" label={t('런타임')} value={runtimeLabel(service.runtime)} />}
        {showName && <InfoChip icon="sensors" label={t('프로젝트')} value={service.agentName} />}
        {service.lastLatency && (
          <InfoChip icon="speed" label={t('지연시간')} value={service.lastLatency} />
        )}
        <InfoChip icon="event" label={t('마지막 체크')} value={lastCheckedText} />
      </div>

      {!service.healthy && service.lastError && (
        <div className="mt-4 p-3 rounded-lg bg-ui-hover-soft border border-ui-border text-sm text-text-secondary">
          <span className="font-semibold text-red-600 dark:text-red-400">{t('오류')}: </span>
          {service.lastError}
        </div>
      )}
    </div>
  );
}
