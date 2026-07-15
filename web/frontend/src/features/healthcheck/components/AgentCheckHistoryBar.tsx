import { useState, useEffect } from 'react';
import { useTranslate } from '@tolgee/react';
import { api, type ServiceUptimeDay } from '../../../services/api';
import { chartCardClass } from '../../../components/charts';
import { getUptimeTextClass } from '../uptimeTone';

interface AgentCheckHistoryBarProps {
  agentId: string;
  /** Omit for a project-level rollup across all of the agent's services. */
  serviceKey?: string;
  refreshKey?: number;
  className?: string;
}

const DAYS = 90;

export function AgentCheckHistoryBar({ agentId, serviceKey, refreshKey, className }: AgentCheckHistoryBarProps) {
  const { t } = useTranslate();
  const [days, setDays] = useState<ServiceUptimeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<ServiceUptimeDay | null>(null);

  useEffect(() => {
    const fetchUptime = serviceKey
      ? api.getAgentServiceUptime(agentId, serviceKey, DAYS)
      : api.getAgentUptime(agentId, DAYS);
    fetchUptime
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
      // d.date is a date-only string ("YYYY-MM-DD"); append time so it parses as
      // LOCAL midnight, not UTC — otherwise today's bucket lands at idx=90 (dropped) in KST.
      const diff = Math.floor((today.getTime() - new Date(`${d.date}T00:00:00`).getTime()) / 86_400_000);
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
    <div className={`p-6 ${chartCardClass} ${className ?? 'mb-8'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-text-base font-bold text-lg">
            {t('90일 업타임 히스토리')}
          </h3>
          {!loading && (
            <p className={`text-sm font-semibold mt-0.5 ${getUptimeTextClass(avgUptime)}`}>
              {avgUptime.toFixed(2)}%
            </p>
          )}
        </div>
        {!loading && incidentDays > 0 && (
          <span className="text-xs text-text-muted">
            {t('{count}일 장애', { count: incidentDays })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 bg-ui-hover rounded animate-pulse" />
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

          {/* 호버 상세를 라벨 줄 가운데 인라인 표시 — 카드 높이 고정(레이아웃 시프트 없음) */}
          <div className="flex justify-between gap-3 text-xs text-text-dim mt-2">
            <span className="shrink-0">{t('90일 전')}</span>
            {hovered && (
              <span className="truncate text-text-secondary">
                <span className="font-semibold">{hovered.date}</span>
                {' — '}
                {hovered.uptimePct.toFixed(1)}% {t('업타임')}
                {' '}({hovered.healthyChecks}/{hovered.totalChecks} {t('정상')})
              </span>
            )}
            <span className="shrink-0">{t('오늘')}</span>
          </div>
        </>
      )}
    </div>
  );
}
