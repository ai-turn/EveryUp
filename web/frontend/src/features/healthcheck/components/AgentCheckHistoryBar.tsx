import { useState, useEffect } from 'react';
import { useTranslate } from '@tolgee/react';
import { api, type ServiceUptimeDay } from '../../../services/api';
import { getUptimeTextClass } from '../uptimeTone';

interface AgentCheckHistoryBarProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

const DAYS = 90;

export function AgentCheckHistoryBar({ agentId, serviceKey, refreshKey }: AgentCheckHistoryBarProps) {
  const { t } = useTranslate();
  const [days, setDays] = useState<ServiceUptimeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<ServiceUptimeDay | null>(null);

  useEffect(() => {
    api.getAgentServiceUptime(agentId, serviceKey, DAYS)
      .then(setDays)
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  // Pad to 90 slots oldest-first with empty placeholders.
  const slots: (ServiceUptimeDay | null)[] = (() => {
    const result: (ServiceUptimeDay | null)[] = Array(DAYS).fill(null);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    days.forEach((d) => {
      const diff = Math.floor((today.getTime() - new Date(d.date).getTime()) / 86_400_000);
      const idx = DAYS - 1 - diff;
      if (idx >= 0 && idx < DAYS) result[idx] = d;
    });
    return result;
  })();

  const incidentDays = days.filter((d) => d.uptimePct < 99.5).length;
  const avgUptime = days.length > 0
    ? days.reduce((s, d) => s + d.uptimePct, 0) / days.length
    : 100;

  return (
    <div className="mb-8 p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-slate-900 dark:text-white font-bold text-lg">
            {t('90일 업타임 히스토리')}
          </h3>
          {!loading && (
            <p className={`text-sm font-semibold mt-0.5 ${getUptimeTextClass(avgUptime)}`}>
              {avgUptime.toFixed(2)}%
            </p>
          )}
        </div>
        {!loading && incidentDays > 0 && (
          <span className="text-xs text-slate-500 dark:text-text-muted-dark">
            {t('{count}일 장애', { count: incidentDays })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 bg-slate-100 dark:bg-ui-hover-dark rounded animate-pulse" />
      ) : (
        <>
          <div className="flex gap-px">
            {slots.map((day, i) => (
                <div
                  key={i}
                  className={`flex-1 h-8 rounded-sm cursor-default transition-opacity hover:opacity-75 ${
                    day === null
                      ? 'bg-slate-200 dark:bg-ui-hover-dark'
                      : day.uptimePct >= 99.5
                        ? 'bg-emerald-500'
                        : day.uptimePct >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                  }`}
                  onMouseEnter={() => day && setHovered(day)}
                  onMouseLeave={() => setHovered(null)}
                />
            ))}
          </div>

          {hovered && (
            <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-ui-hover-dark text-xs text-slate-700 dark:text-text-secondary-dark">
              <span className="font-semibold">{hovered.date}</span>
              {' — '}
              {hovered.uptimePct.toFixed(1)}% {t('업타임')}
              {' '}({hovered.healthyChecks}/{hovered.totalChecks} {t('정상')})
            </div>
          )}

          <div className="flex justify-between text-xs text-slate-400 dark:text-text-dim-dark mt-2">
            <span>{t('90일 전')}</span>
            <span>{t('오늘')}</span>
          </div>
        </>
      )}
    </div>
  );
}
