import { useState, useEffect, useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { api, type AgentEvent } from '../../../services/api';

interface AgentFailureHistoryProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

const ALERT_TYPES = new Set(['alert_sent', 'recovery_sent']);

export function AgentFailureHistory({ agentId, serviceKey, refreshKey }: AgentFailureHistoryProps) {
  const { t } = useTranslate();
  const { i18n } = useTranslation('common');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language],
  );

  useEffect(() => {
    api.getAgentServiceKeyEvents(agentId, serviceKey, 50)
      .then((data) => setEvents(data.filter((e) => ALERT_TYPES.has(e.type))))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  if (loading) {
    return (
      <div className="mb-8 p-6 rounded-xl border border-ui-border bg-white dark:bg-chart-bg animate-pulse">
        <div className="h-5 bg-ui-active rounded w-40 mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="h-14 bg-ui-hover rounded-lg mb-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8 p-6 rounded-xl border border-ui-border bg-bg-surface">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 shrink-0">
          <MaterialIcon name="history" className="text-lg text-red-500" />
        </div>
        <div>
          <h2 className="text-text-base text-xl font-bold tracking-tight">
            {t('최근 장애 기록')}
          </h2>
          <p className="text-text-muted text-sm">
            {t('Agent 알림 이벤트')}
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <MaterialIcon name="check_circle" className="text-2xl text-emerald-500" />
          </div>
          <p className="text-text-muted text-sm">{t('장애 기록이 없습니다')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const isAlert = event.type === 'alert_sent';
            return (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  isAlert
                    ? 'border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10'
                    : 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10'
                }`}
              >
                <MaterialIcon
                  name={isAlert ? 'error' : 'check_circle'}
                  className={`text-xl shrink-0 mt-0.5 ${isAlert ? 'text-red-500' : 'text-emerald-500'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-base truncate">
                    {event.message || (isAlert ? t('장애 감지') : t('복구 감지'))}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatDistanceToNow(new Date(event.time), { addSuffix: true, locale: dateLocale })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
