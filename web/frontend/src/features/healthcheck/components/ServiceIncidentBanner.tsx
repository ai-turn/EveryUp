import { useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';

interface ServiceIncidentBannerProps {
  service: AgentServiceFlat;
  /** Jump to the tab most useful for triaging the incident (logs). */
  onInvestigate: () => void;
}

// Prominent red banner shown at the top of a service's detail when it is down,
// so the cause, impact, and next action are visible without scrolling.
// Renders nothing for healthy services.
export function ServiceIncidentBanner({ service, onInvestigate }: ServiceIncidentBannerProps) {
  const { t } = useTranslate();
  const { i18n } = useTranslation('common');

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language],
  );

  if (service.healthy) return null;

  const since = service.observedAt
    ? formatDistanceToNow(new Date(service.observedAt), { addSuffix: true, locale: dateLocale })
    : null;

  return (
    <div className="flex items-center gap-3.5 mb-5 rounded-xl border border-red-200 dark:border-red-800/50 border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/15 px-4 py-3.5">
      <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-red-100 dark:bg-red-900/40">
        <MaterialIcon name="warning" className="text-xl text-red-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-red-700 dark:text-red-400">
          {t('진행 중인 장애')} — {service.name}
        </p>
        <p className="text-xs text-red-600/90 dark:text-red-300/80 mt-0.5 truncate">
          {service.lastError || t('서비스가 응답하지 않습니다')}
          {since && <span className="text-red-500/70 dark:text-red-300/60"> · {t('마지막 응답')} {since}</span>}
        </p>
      </div>
      <button
        onClick={onInvestigate}
        className="shrink-0 inline-flex items-center gap-1 h-9 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
      >
        {t('로그 확인')}
        <MaterialIcon name="arrow_forward" className="text-base" />
      </button>
    </div>
  );
}
