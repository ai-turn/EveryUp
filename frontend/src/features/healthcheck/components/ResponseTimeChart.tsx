import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { ChartTooltip, formatAxisValue, getChartTheme, getYAxisMax } from '../../../components/charts';
import { api, Metric } from '../../../services/api';

type TimeRange = '24H' | '7D' | '30D';

interface ResponseTimeChartProps {
  serviceId: string;
  refreshKey?: number;
  /** Timeout threshold in milliseconds - renders a dashed SLO line on the chart */
  timeout?: number;
}

interface ChartPoint {
  responseTime: number;
  time: Date;
  timeLabel: string;
}

function getTimeRangeParams(range: TimeRange): { from: string; limit: string } {
  const now = new Date();
  let from: Date;

  switch (range) {
    case '24H':
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7D':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30D':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return {
    from: from.toISOString(),
    limit: range === '24H' ? '48' : range === '7D' ? '84' : '90',
  };
}

const TIME_RANGE_KEYS: Record<TimeRange, string> = {
  '24H': '최근 24시간',
  '7D': '최근 7일',
  '30D': '최근 30일',
};

export function ResponseTimeChart({ serviceId, refreshKey, timeout }: ResponseTimeChartProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const theme = getChartTheme();

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!initialLoadDone.current) {
        setLoading(true);
      }
      try {
        const params = getTimeRangeParams(timeRange);
        const data = await api.getServiceMetrics(serviceId, params);
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };

    fetchMetrics();
  }, [serviceId, timeRange, refreshKey]);

  const chartData = useMemo<ChartPoint[]>(() => {
    return [...metrics]
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
      .map((metric) => {
        const time = new Date(metric.checkedAt);
        return {
          responseTime: metric.responseTime,
          time,
          timeLabel: formatTimeLabel(time, timeRange),
        };
      });
  }, [metrics, timeRange]);

  const values = chartData.map((point) => point.responseTime).filter(Number.isFinite);
  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const p95 = percentile(values, 0.95);
  const yMax = getYAxisMax({ unit: 'ms' }, timeout ? [...values, timeout] : values);
  const chartColor = '#3b82f6';
  const rangeLabel = t(TIME_RANGE_KEYS[timeRange]);
  const title = t('평균 지연 시간');
  const responseTimeLabel = t('응답 시간');
  const isEmpty = !loading && chartData.length === 0;

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-ui-border-dark dark:bg-bg-surface-dark">
      <div className="flex flex-col gap-4 px-5 pb-3 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-text-muted-dark">
            {t(`${rangeLabel} 동안의 P95 및 평균 지연 시간`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isEmpty && !loading && (
            <div className="hidden items-center gap-2 sm:flex">
              <InlineStat label="Avg" value={avg} color={chartColor} />
              <span className="h-4 w-px bg-slate-200 dark:bg-ui-border-dark" />
              <InlineStat label="P95" value={p95} color="#f59e0b" />
            </div>
          )}
          <div role="group" aria-label={title} className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-ui-border-dark dark:bg-bg-surface-dark">
            {(['24H', '7D', '30D'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                aria-pressed={timeRange === range}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  timeRange === range
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-text-muted-dark dark:hover:bg-ui-hover-dark dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-2 pb-4 pt-1">
        <div className="h-72 w-full">
          {loading ? (
            <div className="grid h-full place-items-center text-sm text-slate-400 dark:text-text-dim-dark">
              {tc('common.loading')}
            </div>
          ) : isEmpty ? (
            <div className="grid h-full place-items-center text-sm text-slate-400 dark:text-text-dim-dark">
              {tc('common.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 16, right: 24, left: 4, bottom: 2 }}>
                <defs>
                  <linearGradient id="response-time-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.18} />
                    <stop offset="65%" stopColor={chartColor} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke={theme.gridColor} strokeDasharray="2 8" vertical={false} />

                <XAxis
                  dataKey="timeLabel"
                  tick={{ fontSize: 11, fill: theme.tickColor, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval={getXAxisInterval(chartData.length)}
                  minTickGap={20}
                />

                <YAxis
                  domain={[0, yMax]}
                  tick={{ fontSize: 11, fill: theme.tickColor, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickCount={5}
                  tickFormatter={(value) => formatAxisValue(Number(value), 'ms')}
                />

                {timeout != null && timeout > 0 && timeout <= yMax && (
                  <ReferenceLine
                    y={timeout}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{
                      value: `${t('타임아웃')} ${formatLatency(timeout)}`,
                      position: 'right',
                      fill: '#f59e0b',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                )}

                <Tooltip
                  cursor={{ stroke: theme.gridColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={
                    <ChartTooltip
                      unit=""
                      theme={theme}
                      valueFormatter={formatLatency}
                    />
                  }
                />

                <Area
                  type="monotoneX"
                  dataKey="responseTime"
                  name={responseTimeLabel}
                  stroke="none"
                  fill="url(#response-time-area)"
                  fillOpacity={1}
                  isAnimationActive={false}
                />

                <Line
                  type="monotoneX"
                  dataKey="responseTime"
                  name={responseTimeLabel}
                  stroke={chartColor}
                  strokeWidth={2.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4.5, stroke: '#ffffff', strokeWidth: 2, fill: chartColor }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function InlineStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-400 dark:text-text-dim-dark">{label}</span>
      <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-text-base-dark">
        {formatLatency(value)}
      </span>
    </div>
  );
}

function getXAxisInterval(pointCount: number): number {
  if (pointCount <= 8) return 0;
  return Math.max(1, Math.ceil(pointCount / 6));
}

function formatTimeLabel(date: Date, range: TimeRange): string {
  if (range === '24H') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

function formatLatency(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}s`;
  return `${Math.round(value)}ms`;
}
