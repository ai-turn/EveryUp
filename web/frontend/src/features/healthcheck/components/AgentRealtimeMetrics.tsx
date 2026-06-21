import { useState, useEffect } from 'react';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../../components/common';
import { api, type ServiceHistoryPoint } from '../../../services/api';

interface AgentRealtimeMetricsProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
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
  const avgLatency = points.length > 0
    ? Math.round(points.reduce((s, p) => s + p.latencyMs, 0) / points.length)
    : 0;
  const uptimePct = points.length > 0
    ? points.reduce((s, p) => s + p.uptimePct, 0) / points.length
    : 0;

  const metrics = [
    {
      label: t('평균 지연 시간'),
      value: totalChecks > 0 ? `${avgLatency}ms` : '-',
      icon: 'speed',
      iconColor: 'text-primary',
      subtext: t('최근 24시간'),
    },
    {
      label: t('업타임'),
      value: totalChecks > 0 ? `${uptimePct.toFixed(2)}%` : '-',
      icon: 'check_circle',
      iconColor: uptimePct >= 99 ? 'text-green-500' : 'text-amber-500',
      subtext: t('총 {count}회 체크', { count: totalChecks }),
    },
    {
      label: t('체크 횟수'),
      value: String(totalChecks),
      icon: 'bar_chart',
      iconColor: 'text-slate-500',
      subtext: t('최근 24시간'),
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
            <p className="text-slate-500 dark:text-text-muted-dark text-sm font-medium">{metric.label}</p>
            <MaterialIcon name={metric.icon} className={`${metric.iconColor} text-lg`} />
          </div>
          <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold">{metric.value}</p>
          <p className="text-slate-400 dark:text-text-chart-dim text-sm">{metric.subtext}</p>
        </div>
      ))}
    </div>
  );
}
