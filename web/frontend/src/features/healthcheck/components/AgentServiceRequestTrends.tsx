import { useState, useEffect, useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { ChartTooltip, formatAxisValue, getChartTheme } from '../../../components/charts';
import { api, type ApiRequestStatBucket, type ApiRequestStatusSummary } from '../../../services/api';

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
  /** Controlled range from the page-header picker; when set, own buttons hide. */
  range?: TimeRange;
}

interface ChartPoint {
  timeLabel: string;
  count: number;
  errorRate: number; // percent
  p50: number;
  p95: number;
  hasLatency: boolean;
}

export function AgentServiceRequestTrends({ agentId, serviceKey, refreshKey, range: controlledRange }: Props) {
  const { t } = useTranslate();
  const [localRange, setLocalRange] = useState<TimeRange>('6h');
  const range = controlledRange ?? localRange;
  const [buckets, setBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [summary, setSummary] = useState<ApiRequestStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = RANGES.find((x) => x.value === range)!;
    const from = new Date(Date.now() - r.hours * 3600 * 1000).toISOString();
    const params = { from, bucketMins: r.bucketMins };
    setLoading(true);
    const fetchStats = serviceKey
      ? api.getAgentServiceRequestStats(agentId, serviceKey, params)
      : api.getAgentRequestStats(agentId, params);
    fetchStats
      .then((b) => setBuckets(b ?? []))
      .catch(() => setBuckets([]))
      .finally(() => setLoading(false));
    // Non-critical — the strip hides itself when the summary is missing.
    api.getRequestStatusSummary(agentId, serviceKey, { from })
      .then((s) => setSummary(s))
      .catch(() => setSummary(null));
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
    <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-900 dark:text-white font-bold text-base">{t('요청 추이')}</h3>
        {!controlledRange && (
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setLocalRange(r.value)}
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
        )}
      </div>

      {/* Status-class distribution + top 5xx endpoint (1a 콘솔 prototype) */}
      {summary && (summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther) > 0 && (() => {
        const total = summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
        const classes = [
          { label: '2xx', count: summary.count2xx, bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
          { label: '3xx', count: summary.count3xx, bar: 'bg-slate-400', text: 'text-slate-500 dark:text-text-muted-dark' },
          { label: '4xx', count: summary.count4xx, bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
          { label: '5xx', count: summary.count5xx, bar: 'bg-red-500', text: 'text-red-500' },
        ].filter((c) => c.count > 0);
        return (
          <div className="mb-4">
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-ui-hover-dark">
              {classes.map((c) => (
                <div key={c.label} className={c.bar} style={{ width: `${(c.count / total) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-2xs">
              {classes.map((c) => (
                <span key={c.label} className={`font-mono font-semibold ${c.text}`}>
                  {c.label} {((c.count / total) * 100).toFixed(1)}%
                </span>
              ))}
              {summary.top5xxPath && (
                <span className="text-slate-500 dark:text-text-muted-dark truncate">
                  · {t('5xx 최다')}: <span className="font-mono font-semibold text-red-500">{summary.top5xxMethod} {summary.top5xxPath}</span> ×{summary.top5xxCount}
                </span>
              )}
            </div>
          </div>
        );
      })()}

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
            <Line type="monotone" dataKey="p50" name="p50" stroke={theme.primaryColor} strokeWidth={2} dot={false} connectNulls />
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
          <Bar yAxisId="count" dataKey="count" name={t('요청 수')} fill={theme.primaryColor} fillOpacity={0.35} radius={[2, 2, 0, 0]} />
          <Line yAxisId="err" type="monotone" dataKey="errorRate" name={t('에러율(%)')} stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
