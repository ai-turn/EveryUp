import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common';
import { api, Metric } from '../../../services/api';

interface FailureHistoryProps {
  serviceId: string;
  refreshKey?: number;
}

const MAX_FAILURES = 10;

export function FailureHistory({ serviceId, refreshKey }: FailureHistoryProps) {
  const { t, i18n } = useTranslation();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language]
  );

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      try {
        const data = await api.getServiceMetrics(serviceId, { limit: '100' });
        const failures = data
          .filter((m) => m.status === 'failure')
          .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
          .slice(0, MAX_FAILURES);
        setMetrics(failures);
      } catch (err) {
        console.error('Failed to fetch failure history:', err);
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };
    fetchMetrics();
  }, [serviceId, refreshKey]);

  return (
    <div className="mb-8 p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 shrink-0">
          <MaterialIcon name="history" className="text-lg text-red-500" />
        </div>
        <div>
          <h2 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">
            {t('services.detail.failureHistory.title')}
          </h2>
          <p className="text-slate-400 dark:text-text-chart-dim text-sm">
            {t('services.detail.failureHistory.desc')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="text-slate-400 dark:text-text-dim-dark text-sm">{t('common.loading')}</span>
        </div>
      ) : metrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <MaterialIcon name="check_circle" className="text-3xl text-green-500" />
          <p className="text-sm text-slate-500 dark:text-text-muted-dark">
            {t('services.detail.failureHistory.noFailures')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {metrics.map((m, i) => (
            <FailureRow key={m.id || i} metric={m} dateLocale={dateLocale} />
          ))}
        </div>
      )}
    </div>
  );
}

interface FailureRowProps {
  metric: Metric;
  dateLocale: typeof ko;
}

function FailureRow({ metric, dateLocale }: FailureRowProps) {
  const relative = formatDistanceToNow(new Date(metric.checkedAt), {
    addSuffix: true,
    locale: dateLocale,
  });
  const absolute = new Date(metric.checkedAt).toLocaleString();

  return (
    <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
      <div className="flex items-center gap-3">
        {/* Red dot */}
        <div className="shrink-0 w-2 h-2 rounded-full bg-red-500" />

        {/* Time */}
        <div className="shrink-0 min-w-0">
          <span
            className="text-sm font-semibold text-slate-700 dark:text-text-base-dark cursor-default"
            title={absolute}
          >
            {relative}
          </span>
          <p className="text-xs text-slate-400 dark:text-text-dim-dark">{absolute}</p>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Status code */}
          {metric.statusCode != null && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              HTTP {metric.statusCode}
            </span>
          )}

          {/* Response time */}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-secondary-dark">
            <MaterialIcon name="timer" className="text-xs" />
            {Math.round(metric.responseTime)}ms
          </span>
        </div>
      </div>

      {/* Error message */}
      {metric.errorMessage && (
        <p className="mt-1.5 ml-5 text-xs text-red-600 dark:text-red-400 font-mono break-all">
          {metric.errorMessage}
        </p>
      )}
    </div>
  );
}

