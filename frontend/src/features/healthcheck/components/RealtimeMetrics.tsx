import { useState, useEffect } from 'react';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../../components/common';
import { api, MetricsSummary, Metric } from '../../../services/api';

interface RealtimeMetricsProps {
  serviceId: string;
  refreshKey?: number;
}

export function RealtimeMetrics({ serviceId, refreshKey }: RealtimeMetricsProps) {
  const { t } = useTranslate();
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [recentFailures, setRecentFailures] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, metricsData] = await Promise.all([
          api.getServiceMetricsSummary(serviceId),
          api.getServiceMetrics(serviceId, { limit: '100' }),
        ]);
        setSummary(summaryData);
        setRecentFailures(metricsData.filter((m: Metric) => m.status === 'failure').length);
      } catch (err) {
        console.error('Failed to fetch metrics summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [serviceId, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl p-6 border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg animate-pulse"
          >
            <div className="h-4 bg-slate-200 dark:bg-ui-active-dark rounded w-24" />
            <div className="h-8 bg-slate-200 dark:bg-ui-active-dark rounded w-32 mt-2" />
            <div className="h-3 bg-slate-200 dark:bg-ui-active-dark rounded w-20 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: t('평균 지연 시간'),
      value: summary ? `${Math.round(summary.avgResponseTime)}ms` : '-',
      icon: 'speed',
      iconColor: 'text-primary',
      subtext: summary
        ? t('최대 {max}ms / 최소 {min}ms', {
            max: Math.round(summary.maxResponseTime),
            min: Math.round(summary.minResponseTime),
          })
        : '-',
    },
    {
      label: t('성공률'),
      value: summary ? `${(summary.uptime ?? 0).toFixed(2)}%` : '-',
      icon: 'check_circle',
      iconColor: summary && (summary.uptime ?? 0) >= 99 ? 'text-green-500' : 'text-amber-500',
      subtext: summary
        ? t('총 {count}회 체크', { count: summary.totalChecks })
        : '-',
    },
    {
      label: t('최근 장애'),
      value: summary ? String(recentFailures) : '-',
      icon: recentFailures === 0 ? 'check_circle' : 'error',
      iconColor: recentFailures === 0 ? 'text-green-500' : 'text-red-500',
      subtext: t('최근 100회 체크 기준'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex flex-col gap-2 rounded-xl p-6 border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg"
        >
          <div className="flex justify-between items-start">
            <p className="text-slate-500 dark:text-text-muted-dark text-sm font-medium">
              {metric.label}
            </p>
            <MaterialIcon name={metric.icon} className={`${metric.iconColor} text-lg`} />
          </div>
          <div className="flex items-baseline gap-3">
            <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold">
              {metric.value}
            </p>
          </div>
          <p className="text-slate-400 dark:text-text-chart-dim text-xs">{metric.subtext}</p>
        </div>
      ))}
    </div>
  );
}
