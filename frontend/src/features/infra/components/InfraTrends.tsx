import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { MaterialIcon } from '../../../components/common';
import { useMonitoringTrends } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { ChartData } from '../../../types/infra';

interface InfraTrendsProps {
  hostId: string;
  refreshKey?: number;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getIsDark() {
  return document.documentElement.classList.contains('dark');
}

function getXAxisInterval(pointCount: number): number {
  return Math.max(1, Math.floor(pointCount / 12));
}

export function InfraTrends({ hostId, refreshKey = 0 }: InfraTrendsProps) {
  const { t } = useTranslation(['infra', 'common']);
  const [timeRange, setTimeRange] = useState<'6H' | '12H' | '24H'>('6H');
  const { data: charts, loading } = useMonitoringTrends(hostId, timeRange.toLowerCase(), refreshKey);

  const isDark = getIsDark();
  const gridColor     = isDark ? getCssVar('--color-chart-border')   : '#e2e8f0';
  const tickColor     = isDark ? getCssVar('--color-text-muted-dark') : '#94a3b8';
  const tooltipBg     = isDark ? getCssVar('--color-bg-surface-dark') : '#ffffff';
  const tooltipBorder = isDark ? getCssVar('--color-chart-border')   : '#e2e8f0';

  const rangeLabel: Record<string, string> = {
    '6H':  t('infra.trends.last6h'),
    '12H': t('infra.trends.last12h'),
    '24H': t('infra.trends.last24h'),
  };

  const pointCount = charts?.[0]?.data?.length ?? 12;
  const xInterval  = getXAxisInterval(pointCount);

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('infra.trends.title')}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-text-muted-dark">
            {rangeLabel[timeRange]}
          </p>
        </div>

        {/* 시간 범위 토글 + 보조 설명 */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex bg-slate-100 dark:bg-chart-surface rounded-lg p-1">
            {(['6H', '12H', '24H'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-white dark:bg-chart-bg text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-text-dim-dark">전체 차트에 적용</p>
        </div>
      </div>

      {/* Charts Grid — 2×2 */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {(charts || []).map((chart, chartIndex) => (
            <ChartCard
              key={chart.title}
              chart={chart}
              chartIndex={chartIndex}
              xInterval={xInterval}
              timeRange={timeRange}
              gridColor={gridColor}
              tickColor={tickColor}
              tooltipBg={tooltipBg}
              tooltipBorder={tooltipBorder}
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
  timeRange,
  gridColor,
  tickColor,
  tooltipBg,
  tooltipBorder,
}: {
  chart: ChartData;
  chartIndex: number;
  xInterval: number;
  timeRange: string;
  gridColor: string;
  tickColor: string;
  tooltipBg: string;
  tooltipBorder: string;
}) {
  const primary = chart.series[0];
  const values  = chart.data.map((p) => Number(p[primary.key])).filter(Number.isFinite);
  const latest  = values.length > 0 ? values[values.length - 1] : 0;
  const peak    = values.length > 0 ? Math.max(...values) : 0;

  // 전체 시리즈의 최대값이 0에 가까우면 빈 상태
  const allValues = chart.series.flatMap((s) =>
    chart.data.map((p) => Number(p[s.key])).filter(Number.isFinite)
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const isEmpty = chart.data.length > 0 && maxVal < 0.001;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-chart-border bg-white dark:bg-bg-surface-dark shadow-sm">
      {/* 카드 상단: 제목 + stat (같은 행) */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900 dark:text-white">{chart.title}</p>
          {/* 범례 */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {chart.series.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 dark:bg-ui-hover-dark/50 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:text-text-muted-dark"
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* 현재 / 최고 — 제목 우측 inline */}
        {!isEmpty && (
          <div className="flex shrink-0 items-center gap-1.5">
            <InlineStat label="현재" value={latest} unit={chart.unit} color={primary.color} />
            <span className="text-slate-200 dark:text-ui-border-dark">·</span>
            <InlineStat label="최고" value={peak} unit={chart.unit} color="#f59e0b" />
          </div>
        )}
      </div>

      {/* 차트 또는 빈 상태 */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400 dark:text-text-dim-dark">
          <MaterialIcon name="bar_chart" className="text-3xl opacity-30" />
          <p className="text-xs font-medium">최근 {timeRange} 동안 활동 없음</p>
        </div>
      ) : (
        <div className="px-3 pb-4">
          <div className="rounded-lg bg-slate-50/60 dark:bg-chart-surface/30 px-1 pt-2 pb-1">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {chart.series.map((s, si) => (
                    <linearGradient key={s.key} id={`grad-${chartIndex}-${si}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={s.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid strokeDasharray="3 6" stroke={gridColor} vertical={false} />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: tickColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  interval={xInterval}
                />

                <YAxis
                  domain={chart.yMax !== undefined ? [0, chart.yMax] : ['auto', 'auto']}
                  tick={{ fontSize: 10, fill: tickColor }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tickFormatter={(v) => `${v}${chart.unit}`}
                />

                <Tooltip
                  contentStyle={{
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: tickColor, fontWeight: 700, marginBottom: 6 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any, name: string) => [
                    `${formatMetricValue(Number(value) || 0)} ${chart.unit}`,
                    name,
                  ]) as any}
                />

                {chart.series.map((s, si) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    fill={`url(#grad-${chartIndex}-${si})`}
                    fillOpacity={1}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-slate-400 dark:text-text-dim-dark">{label}</span>
      <span className="text-sm font-bold tabular-nums text-slate-800 dark:text-text-base-dark">
        {formatMetricValue(value)}
        <span className="ml-0.5 text-xs font-semibold text-slate-400 dark:text-text-dim-dark">{unit}</span>
      </span>
    </div>
  );
}

function formatMetricValue(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10)  return value.toFixed(1);
  return value.toFixed(2);
}
