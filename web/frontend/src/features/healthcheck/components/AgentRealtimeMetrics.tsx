import { useState, useEffect } from 'react';
import { useTranslate } from '@tolgee/react';
import { api, type ServiceHistoryPoint } from '../../../services/api';
import { getUptimeTone, getUptimeTextClass, UPTIME_SLO_TARGET } from '../uptimeTone';

interface AgentRealtimeMetricsProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

// "정상 범위" baseline for average latency, used only for the card's hint line.
const LATENCY_NORMAL_MAX_MS = 200;

// Keep one decimal under 10ms so sub-millisecond latencies (e.g. 0.4ms) don't read as 0ms.
function formatLatency(ms: number): string {
  return ms < 10 ? String(Number(ms.toFixed(1))) : String(Math.round(ms));
}

// Trend of the recent half of the window vs the older half (not vs a previous day).
// Returns null when there isn't enough signal to be meaningful.
function halfSplitTrendPct(values: number[]): number | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const older = mean(values.slice(0, mid));
  const newer = mean(values.slice(mid));
  if (older <= 0) return null;
  return Math.round(((newer - older) / older) * 100);
}

export function AgentRealtimeMetrics({ agentId, serviceKey, refreshKey }: AgentRealtimeMetricsProps) {
  const { t } = useTranslate();
  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgentServiceHistory(agentId, serviceKey, '24h')
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl p-6 border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-ui-active-dark rounded w-24" />
            <div className="h-8 bg-slate-200 dark:bg-ui-active-dark rounded w-32 mt-2" />
            <div className="h-3 bg-slate-200 dark:bg-ui-active-dark rounded w-20 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  const totalChecks = points.reduce((s, p) => s + p.total, 0);
  const hasData = totalChecks > 0;
  const avgLatency = points.length > 0
    ? points.reduce((s, p) => s + p.latencyMs, 0) / points.length
    : 0;
  const uptimePct = points.length > 0
    ? points.reduce((s, p) => s + p.uptimePct, 0) / points.length
    : 0;

  // Latency trend — lower is better, so a negative delta is the "good" direction.
  const latencyTrend = hasData ? halfSplitTrendPct(points.map((p) => p.latencyMs)) : null;
  const uptimeTone = getUptimeTone(uptimePct);
  const uptimePill = uptimeTone === 'healthy'
    ? { label: t('정상'), cls: 'text-emerald-600 bg-emerald-500/10' }
    : uptimeTone === 'warning'
      ? { label: t('주의'), cls: 'text-amber-600 bg-amber-500/10' }
      : { label: t('위험'), cls: 'text-red-600 bg-red-500/10' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Average latency */}
      <div className="flex flex-col rounded-xl p-6 border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-text-muted-dark text-sm font-medium">{t('평균 응답')}</p>
          {latencyTrend !== null && latencyTrend !== 0 && (
            <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${
              latencyTrend < 0
                ? 'text-emerald-600 bg-emerald-500/10'
                : 'text-amber-600 bg-amber-500/10'
            }`}>
              {latencyTrend < 0 ? '↓' : '↑'} {Math.abs(latencyTrend)}%
            </span>
          )}
        </div>
        <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold tabular-nums mt-2">
          {hasData ? `${formatLatency(avgLatency)}ms` : '-'}
        </p>
        <p className="text-slate-400 dark:text-text-chart-dim text-xs mt-1">
          {t('정상 범위')} {`< ${LATENCY_NORMAL_MAX_MS}ms`}
        </p>
      </div>

      {/* Uptime */}
      <div className="flex flex-col rounded-xl p-6 border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-text-muted-dark text-sm font-medium">{t('업타임')}</p>
          {hasData && (
            <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${uptimePill.cls}`}>{uptimePill.label}</span>
          )}
        </div>
        <p className={`tracking-tight text-3xl font-bold tabular-nums mt-2 ${hasData ? getUptimeTextClass(uptimePct) : 'text-slate-900 dark:text-white'}`}>
          {hasData ? `${uptimePct.toFixed(2)}%` : '-'}
        </p>
        <p className="text-slate-400 dark:text-text-chart-dim text-xs mt-1">
          {t('목표')} {`${UPTIME_SLO_TARGET}%`}
        </p>
      </div>

      {/* Check count */}
      <div className="flex flex-col rounded-xl p-6 border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-text-muted-dark text-sm font-medium">{t('체크 횟수')}</p>
        </div>
        <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold tabular-nums mt-2">
          {String(totalChecks)}
        </p>
        <p className="text-slate-400 dark:text-text-chart-dim text-xs mt-1">{t('최근 24시간')}</p>
      </div>
    </div>
  );
}
