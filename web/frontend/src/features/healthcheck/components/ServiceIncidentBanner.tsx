import { useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Button, MaterialIcon } from '../../../components/common';
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
    <div className="flex items-center gap-3.5 mb-5 rounded-xl border border-ui-border bg-bg-surface px-4 py-3.5">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">
          {t('진행 중인 장애')} — {service.name}
        </p>
        <p className="text-xs text-text-muted mt-0.5 truncate">
          {service.lastError || t('서비스가 응답하지 않습니다')}
          {since && <span className="text-text-dim"> · {t('마지막 응답')} {since}</span>}
        </p>
      </div>
      <Button variant="danger" onClick={onInvestigate}>
        {t('로그 확인')}
        <MaterialIcon name="arrow_forward" className="text-base" />
      </Button>
    </div>
  );
}
