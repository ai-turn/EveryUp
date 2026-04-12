import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Metric, UptimeData } from '../../../services/api';

interface CheckHistoryBarProps {
  serviceId: string;
  refreshKey?: number;
}

const SLOT_COUNT = 90;


export function CheckHistoryBar({ serviceId, refreshKey }: CheckHistoryBarProps) {
  const { t } = useTranslation(['healthcheck', 'common']);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [uptimeData, setUptimeData] = useState<UptimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<Metric | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    Promise.all([
      api.getServiceMetrics(serviceId, { limit: String(SLOT_COUNT) }),
      api.getServiceUptime(serviceId, { days: '90' }),
    ])
      .then(([metricsData, uptime]) => {
        setMetrics(
          [...metricsData].sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
        );
        setUptimeData(uptime);
      })
      .catch((err) => console.error('Failed to fetch check history:', err))
      .finally(() => {
        setLoading(false);
        initialLoadDone.current = true;
      });
  }, [serviceId, refreshKey]);

  // ── Per-check stats ───────────────────────────────────────────────────────
  const emptySlots = Math.max(0, SLOT_COUNT - metrics.length);
  const failCount = metrics.filter((m) => m.status === 'failure').length;
  const successRate =
    metrics.length > 0 ? Math.round(((metrics.length - failCount) / metrics.length) * 100) : null;

  // ── 90-day uptime grid ────────────────────────────────────────────────────
  const healthGrid = (() => {
    if (!uptimeData?.days) return Array.from({ length: 90 }, () => ({ status: 'up' as const, uptime: 100, date: '' }));
    const days = [...uptimeData.days];
    while (days.length < 90) days.unshift({ date: '', status: 'up' as const, uptime: 100 });
    return days.slice(-90);
  })();

  const incidentDays = healthGrid.filter((d) => d.status === 'down' || d.status === 'partial').length;

  return (
    <div className="mb-8 p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">

      {/* ── Section 1: Recent checks ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">
            {t('healthcheck.detail.checkHistory.title')}
          </h2>
          <p className="text-slate-400 dark:text-text-chart-dim text-sm">
            {t('healthcheck.detail.checkHistory.desc', { count: SLOT_COUNT })}
          </p>
        </div>
        {!loading && successRate !== null && (
          <div className="text-right shrink-0">
            <span className={`text-2xl font-bold ${
              successRate >= 99 ? 'text-green-500' : successRate >= 95 ? 'text-amber-500' : 'text-red-500'
            }`}>
              {successRate}%
            </span>
            <p className="text-xs text-slate-400 dark:text-text-muted-dark">
              {t('healthcheck.detail.checkHistory.successRate')}
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-10 flex items-center justify-center">
          <span className="text-slate-400 dark:text-text-dim-dark text-sm">{t('common.loading')}</span>
        </div>
      ) : (
        <>
          <div className="flex gap-px items-stretch h-10">
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 rounded-sm bg-slate-100 dark:bg-ui-hover-dark" />
            ))}
            {metrics.map((m, i) => (
              <div
                key={m.id || i}
                onClick={() => setActiveMetric(prev => prev?.id === m.id ? null : m)}
                className={`flex-1 rounded-sm relative group cursor-pointer transition-opacity hover:opacity-75 ${
                  m.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                } ${activeMetric?.id === m.id ? 'ring-2 ring-white ring-offset-1 opacity-90' : ''}`}
              >
                {/* Desktop hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                  <div className="bg-slate-900 dark:bg-slate-700 text-white rounded-lg shadow-xl px-2.5 py-1.5 whitespace-nowrap text-xs">
                    <div className={`font-bold mb-0.5 ${m.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.status === 'success' ? t('common.online') : t('common.offline')}
                    </div>
                    <div className="text-slate-300">{Math.round(m.responseTime)}ms</div>
                    {m.statusCode && <div className="text-slate-400 text-xs">HTTP {m.statusCode}</div>}
                    <div className="text-slate-400 text-xs mt-0.5">{new Date(m.checkedAt).toLocaleString()}</div>
                  </div>
                  <div className="w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45 mx-auto -mt-1" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400 dark:text-text-dim-dark">
            <span>{t('healthcheck.detail.checkHistory.oldest', { count: SLOT_COUNT })}</span>
            <span>{t('healthcheck.detail.checkHistory.latest')}</span>
          </div>

          {/* Mobile tap detail card */}
          {activeMetric && (
            <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-xs sm:hidden">
              <span className={`font-bold shrink-0 ${activeMetric.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {activeMetric.status === 'success' ? t('common.online') : t('common.offline')}
              </span>
              <span className="text-slate-300 tabular-nums">{Math.round(activeMetric.responseTime)}ms</span>
              {activeMetric.statusCode && (
                <span className="text-slate-400">HTTP {activeMetric.statusCode}</span>
              )}
              <span className="text-slate-500 ml-auto truncate">{new Date(activeMetric.checkedAt).toLocaleString()}</span>
            </div>
          )}
        </>
      )}

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="my-5 border-t border-slate-100 dark:border-ui-border-dark" />

      {/* ── Section 2: 90-day uptime summary ─────────────────────────────── */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-ui-active-dark rounded w-40" />
          <div className="h-2 bg-slate-200 dark:bg-ui-active-dark rounded-full" />
          <div className="h-4 bg-slate-200 dark:bg-ui-active-dark rounded w-32" />
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Uptime percentage — large */}
          <div className="shrink-0">
            <p className={`text-3xl font-bold tabular-nums leading-none ${
              (uptimeData?.percentage ?? 0) >= 99 ? 'text-green-500'
              : (uptimeData?.percentage ?? 0) >= 95 ? 'text-amber-500'
              : 'text-red-500'
            }`}>
              {uptimeData ? `${uptimeData.percentage.toFixed(2)}%` : '-'}
            </p>
            <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-1">
              {t('healthcheck.detail.uptime')} (90{t('common.days')})
            </p>
          </div>

          {/* Progress bar + incident count */}
          <div className="flex-1 space-y-2.5">
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-ui-hover-dark overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (uptimeData?.percentage ?? 0) >= 99 ? 'bg-green-500'
                  : (uptimeData?.percentage ?? 0) >= 95 ? 'bg-amber-500'
                  : 'bg-red-500'
                }`}
                style={{ width: `${uptimeData?.percentage ?? 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 dark:text-text-muted-dark">{t('healthcheck.detail.totalIncidents')}</span>
              <span className={`font-semibold ${incidentDays > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                {incidentDays > 0 ? `${incidentDays}${t('common.days')}` : t('common.none', { defaultValue: '-' })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
