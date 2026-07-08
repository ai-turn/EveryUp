import { useState, useEffect, useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { ChartTooltip, formatAxisValue, getChartTheme } from '../../../components/charts';
import { api, type ApiRequestStatBucket } from '../../../services/api';

type TimeRange = '1h' | '6h' | '24h';
// Bucket width per range keeps ~30-60 points on the chart.
const RANGES: { label: string; value: TimeRange; hours: number; bucketMins: number }[] = [
  { label: '1H', value: '1h', hours: 1, bucketMins: 2 },
  { label: '6H', value: '6h', hours: 6, bucketMins: 10 },
  { label: '24H', value: '24h', hours: 24, bucketMins: 30 },
];

interface Props {
  agentId: string;
  /** Omit for a project-level rollup across all of the agent's services. */
  serviceKey?: string;
  refreshKey?: number;
}

interface ChartPoint {
  timeLabel: string;
  count: number;
  errorRate: number; // percent
  p50: number;
  p95: number;
  hasLatency: boolean;
}

export function AgentServiceRequestTrends({ agentId, serviceKey, refreshKey }: Props) {
  const { t } = useTranslate();
  const [range, setRange] = useState<TimeRange>('6h');
  const [buckets, setBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = RANGES.find((x) => x.value === range)!;
    const params = {
      from: new Date(Date.now() - r.hours * 3600 * 1000).toISOString(),
      bucketMins: r.bucketMins,
    };
    setLoading(true);
    const fetchStats = serviceKey
      ? api.getAgentServiceRequestStats(agentId, serviceKey, params)
      : api.getAgentRequestStats(agentId, params);
    fetchStats
      .then((b) => setBuckets(b ?? []))
      .catch(() => setBuckets([]))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, range, refreshKey]);

  const theme = getChartTheme();

  const data: ChartPoint[] = useMemo(() => buckets.map((b) => ({
    timeLabel: new Date(b.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    count: b.count,
    errorRate: b.count > 0 ? Math.round((b.errorCount / b.count) * 1000) / 10 : 0,
    p50: b.p50,
    p95: b.p95,
    hasLatency: b.timed > 0,
  })), [buckets]);

  // Latency series only render when at least one bucket has timed requests —
  // access-log-only services (no duration) show volume + error rate alone.
  const anyLatency = data.some((d) => d.hasLatency);

  if (loading) {
    return <div className="h-56 bg-slate-100 dark:bg-ui-hover-dark rounded-xl animate-pulse" />;
  }
  if (data.length === 0) {
    return null; // empty state is handled by the request list below
  }

  return (
    <div className="p-5 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-900 dark:text-white font-bold text-base">{t('요청 추이')}</h3>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                range === r.value
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-secondary-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Latency percentiles (only when we have timed requests) */}
      {anyLatency && (
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
            <XAxis dataKey="timeLabel" tick={{ fill: theme.tickColor, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => formatAxisValue(v, 'ms')} tick={{ fill: theme.tickColor, fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={({ active, label, payload }) => (
              <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit="ms" theme={theme} valueFormatter={(v) => String(Math.round(v))} />
            )} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="p50" name="p50" stroke="#3b76c9" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="p95" name="p95" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Volume + error rate */}
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
          <XAxis dataKey="timeLabel" tick={{ fill: theme.tickColor, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="count" domain={[0, 'dataMax']} allowDataOverflow tick={{ fill: theme.tickColor, fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <YAxis yAxisId="err" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fill: theme.tickColor, fontSize: 11 }} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
          <Tooltip content={({ active, label, payload }) => (
            <ChartTooltip active={active} label={label} payload={payload as import('../../../components/charts').TooltipPayloadItem[]} unit="" theme={theme} valueFormatter={(v) => String(v)} />
          )} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="count" dataKey="count" name={t('요청 수')} fill="#3b76c9" fillOpacity={0.35} radius={[2, 2, 0, 0]} />
          <Line yAxisId="err" type="monotone" dataKey="errorRate" name={t('에러율(%)')} stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
