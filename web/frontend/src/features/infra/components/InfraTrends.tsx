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
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, areaProps, chartCardClass, formatAxisValue,
  getChartTheme, getYAxisMax, gridProps, lineProps, tooltipCursor, xAxisProps, yAxisProps,
} from '../../../components/charts';
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

  const { data: charts, loading } = useMonitoringTrends(hostId, range, refreshKey);

  const theme = getChartTheme();

  const rangeLabel: Record<GlobalTimeRange, string> = {
    '1h': '최근 1시간',
    '6h': '최근 6시간',
    '24h': '최근 24시간',
  };

  const pointCount = charts?.reduce((max, chart) => Math.max(max, chart.data.length), 0) ?? 12;
  const xInterval = getXAxisInterval(pointCount);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl tracking-tight text-text-base">
            인프라 추세
          </h2>
          <p className="mt-1 text-sm text-text-muted">
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
          {(charts || []).map((chart) => (
            <ChartCard
              key={chart.title}
              chart={chart}
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
  xInterval,
  rangeLabel,
  theme,
}: {
  chart: ChartData;
  xInterval: number;
  rangeLabel: string;
  theme: ReturnType<typeof getChartTheme>;
}) {

  const allValues = chart.series.flatMap((s) =>
    chart.data.map((p) => Number(p[s.key])).filter(Number.isFinite)
  );
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const yMax = getYAxisMax(chart, allValues);
  const isEmpty = chart.data.length === 0 || maxVal < 0.001;

  return (
    <section className={`overflow-hidden ${chartCardClass}`} aria-label={chart.title}>
      <div className="px-5 pb-1 pt-5">
        <p className="truncate text-base text-text-base">{chart.title}</p>
      </div>

      {isEmpty ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-text-dim">
          <MaterialIcon name="show_chart" className="text-4xl opacity-30" />
          <p className="text-sm">
            {`${rangeLabel} 동안 활동 없음`}
          </p>
        </div>
      ) : (
        <div className="px-2 pb-4 pt-1">
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={chart.data} margin={{ top: 16, right: 20, left: 0, bottom: 2 }}>
                <CartesianGrid {...gridProps(theme)} />

                <XAxis dataKey="time" {...xAxisProps(theme)} interval={xInterval} minTickGap={20} />

                <YAxis
                  {...yAxisProps(theme, 42)}
                  domain={[0, yMax]}
                  tickCount={5}
                  allowDecimals={chart.unit !== '%'}
                  tickFormatter={(value) => formatAxisValue(Number(value), chart.unit)}
                />

                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={<ChartTooltip unit={chart.unit} theme={theme} />}
                />

                {chart.series.map((s) => (
                  <Area key={`${s.key}-area`} {...areaProps(s.color)} dataKey={s.key} />
                ))}

                {chart.series.map((s) => (
                  <Line key={`${s.key}-line`} {...lineProps(s.color)} dataKey={s.key} name={s.label} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 px-3">
            <ChartStatsLegend
              series={chart.series.map((s) => ({
                label: s.label,
                color: s.color,
                values: chart.data.map((p) => Number(p[s.key])),
              }))}
              unit={chart.unit}
            />
          </div>
        </div>
      )}
    </section>
  );
}
