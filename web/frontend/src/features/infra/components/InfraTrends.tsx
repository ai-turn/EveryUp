import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { MaterialIcon, type GlobalTimeRange } from '../../../components/common';
import { ChartTooltip, formatAxisValue, formatMetricValue, getChartTheme, getYAxisMax } from '../../../components/charts';
import { useMonitoringTrends } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { ChartData } from '../../../types/infra';

interface InfraTrendsProps {
  hostId: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

function getXAxisInterval(pointCount: number): number {
  if (pointCount <= 8) return 0;
  return Math.max(1, Math.ceil(pointCount / 6));
}

export function InfraTrends({ hostId, refreshKey = 0, range }: InfraTrendsProps) {
  const { t } = useTranslation(['infra', 'common']);
  const { data: charts, loading } = useMonitoringTrends(hostId, range, refreshKey);

  const theme = getChartTheme();

  const rangeLabel: Record<GlobalTimeRange, string> = {
    '1h': t('infra.trends.last1h'),
    '6h': t('infra.trends.last6h'),
    '24h': t('infra.trends.last24h'),
  };

  const pointCount = charts?.reduce((max, chart) => Math.max(max, chart.data.length), 0) ?? 12;
  const xInterval = getXAxisInterval(pointCount);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('infra.trends.title')}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-text-muted-dark">
            {rangeLabel[range]}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(charts || []).map((chart, chartIndex) => (
            <ChartCard
              key={chart.title}
              chart={chart}
              chartIndex={chartIndex}
              xInterval={xInterval}
              rangeLabel={rangeLabel[range]}
              theme={theme}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ChartCard({
  chart,
  chartIndex,
  xInterval,
  rangeLabel,
  theme,
}: {
  chart: ChartData;
  chartIndex: number;
  xInterval: number;
  rangeLabel: string;
  theme: ReturnType<typeof getChartTheme>;
}) {
  const { t } = useTranslation(['infra']);
  const primary = chart.series[0];
  const primaryValues = chart.data.map((p) => Number(p[primary.key])).filter(Number.isFinite);
  const allValues = chart.series.flatMap((s) =>
    chart.data.map((p) => Number(p[s.key])).filter(Number.isFinite)
  );
  const latest = primaryValues.length > 0 ? primaryValues[primaryValues.length - 1] : 0;
  const peak = allValues.length > 0 ? Math.max(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const yMax = getYAxisMax(chart, allValues);
  const isEmpty = chart.data.length === 0 || maxVal < 0.001;

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-chart-border dark:bg-bg-surface-dark"
      aria-label={chart.title}
    >
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900 dark:text-white">{chart.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chart.series.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:border-ui-border-dark dark:bg-ui-hover-dark/40 dark:text-text-muted-dark"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {!isEmpty && (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <InlineStat label={t('infra.trends.now')} value={latest} unit={chart.unit} color={primary.color} />
            <span className="h-4 w-px bg-slate-200 dark:bg-ui-border-dark" />
            <InlineStat label={t('infra.trends.peak')} value={peak} unit={chart.unit} color="#f59e0b" />
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-slate-400 dark:text-text-dim-dark">
          <MaterialIcon name="show_chart" className="text-4xl opacity-30" />
          <p className="text-sm font-medium">
            {t('infra.trends.noActivity', { range: rangeLabel })}
          </p>
        </div>
      ) : (
        <div className="px-2 pb-4 pt-1">
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart.data} margin={{ top: 16, right: 20, left: 0, bottom: 2 }}>
                <defs>
                  {chart.series.map((s, si) => (
                    <linearGradient key={s.key} id={`trend-area-${chartIndex}-${si}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
                      <stop offset="65%" stopColor={s.color} stopOpacity={0.05} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid stroke={theme.gridColor} strokeDasharray="2 8" vertical={false} />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: theme.tickColor, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval={xInterval}
                  minTickGap={20}
                />

                <YAxis
                  domain={[0, yMax]}
                  tick={{ fontSize: 11, fill: theme.tickColor, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickCount={5}
                  allowDecimals={chart.unit !== '%'}
                  tickFormatter={(value) => formatAxisValue(Number(value), chart.unit)}
                />

                <Tooltip
                  cursor={{ stroke: theme.gridColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                  content={<ChartTooltip unit={chart.unit} theme={theme} />}
                />

                {chart.series.map((s, si) => (
                  <Area
                    key={`${s.key}-area`}
                    type="monotoneX"
                    dataKey={s.key}
                    stroke="none"
                    fill={`url(#trend-area-${chartIndex}-${si})`}
                    fillOpacity={1}
                    isAnimationActive={false}
                  />
                ))}

                {chart.series.map((s) => (
                  <Line
                    key={`${s.key}-line`}
                    type="monotoneX"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={{ r: 4.5, stroke: '#ffffff', strokeWidth: 2, fill: s.color }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

function InlineStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-400 dark:text-text-dim-dark">{label}</span>
      <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-text-base-dark">
        {formatMetricValue(value)}
        <span className="ml-0.5 text-xs font-semibold text-slate-400 dark:text-text-dim-dark">{unit}</span>
      </span>
    </div>
  );
}
