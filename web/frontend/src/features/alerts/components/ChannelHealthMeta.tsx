import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import type { NotificationChannelHealth } from '../../../services/api';

interface Props {
  health?: NotificationChannelHealth;
  compact?: boolean;
}

export function ChannelHealthMeta({ health, compact = false }: Props) {
  const { t, i18n } = useTranslation(['alerts', 'common']);
  const locale = i18n.language === 'ko' ? ko : enUS;

  const sent = health?.successCount ?? 0;
  const failed = health?.failedCount ?? 0;
  const total = sent + failed;
  const ruleCount = health?.ruleCount ?? 0;
  const lastSentAt = health?.lastSentAt ? new Date(health.lastSentAt) : null;

  const successRate = total > 0 ? Math.round((sent / total) * 100) : null;
  const rateColor =
    successRate === null
      ? 'text-slate-400 dark:text-text-dim-dark'
      : successRate >= 95
      ? 'text-emerald-500'
      : successRate >= 80
      ? 'text-amber-500'
      : 'text-red-500';

  const gap = compact ? 'gap-3' : 'gap-4';
  const text = 'text-sm';

  return (
    <div className={`flex items-center flex-wrap ${gap} ${text} text-slate-500 dark:text-text-muted-dark`}>
      <span className="inline-flex items-center gap-1" title={t('alerts.health.lastSent', { defaultValue: 'Last sent' })}>
        <MaterialIcon name="schedule" className="text-sm" />
        {lastSentAt
          ? formatDistanceToNow(lastSentAt, { addSuffix: true, locale })
          : t('alerts.health.never', { defaultValue: 'Never sent' })}
      </span>

      {total > 0 ? (
        <span className={`inline-flex items-center gap-1 font-semibold ${rateColor}`} title={t('alerts.health.successRate7d', { defaultValue: '7d success rate' })}>
          <MaterialIcon name="check_circle" className="text-sm" />
          {successRate}% <span className="font-normal text-slate-400 dark:text-text-dim-dark">({sent}/{total})</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1" title={t('alerts.health.noActivity', { defaultValue: 'No activity in last 7 days' })}>
          <MaterialIcon name="check_circle" className="text-sm text-slate-400 dark:text-text-dim-dark" />
          {t('alerts.health.noActivityShort', { defaultValue: '—' })}
        </span>
      )}

      <span className="inline-flex items-center gap-1" title={t('alerts.health.linkedRules', { defaultValue: 'Linked enabled rules' })}>
        <MaterialIcon name="rule" className="text-sm" />
        {t('alerts.health.rulesCount', { count: ruleCount, defaultValue: '{{count}} rules' })}
      </span>
    </div>
  );
}
