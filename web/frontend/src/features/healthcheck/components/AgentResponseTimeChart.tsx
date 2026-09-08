import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { GlobalTimeRange } from '../../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, areaProps, chartCardClass, formatAxisValue,
  getChartTheme, gridProps, lineProps, tooltipCursor, xAxisProps, yAxisProps,
} from '../../../components/charts';
import { api, type ServiceHistoryPoint } from '../../../services/api';

interface AgentResponseTimeChartProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

interface ChartPoint {
  latencyMs: number;
  timeLabel: string;
}

export function AgentResponseTimeChart({ agentId, serviceKey, refreshKey, range }: AgentResponseTimeChartProps) {

  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setPoints(await api.getAgentServiceHistory(agentId, serviceKey, range));
      } catch {
        setPoints([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [agentId, serviceKey, range, refreshKey]);

  const theme = getChartTheme();

  const chartData: ChartPoint[] = points.map((p) => ({
    latencyMs: Math.round(p.latencyMs),
    timeLabel: new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  const maxLatency = chartData.length > 0 ? Math.max(...chartData.map((p) => p.latencyMs)) : 0;
  const yMax = Math.max(maxLatency * 1.2, 100);

  return (
    <div className={`mb-8 p-6 ${chartCardClass}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="type-card-title text-text-base">응답 시간</h3>
      </div>

      {loading ? (
        <div className="h-48 bg-ui-hover rounded animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-text-dim text-sm">
          데이터 없음
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={192} initialDimension={CHART_INITIAL_DIMENSION}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps(theme)} />
              <XAxis dataKey="timeLabel" {...xAxisProps(theme)} />
              <YAxis
                {...yAxisProps(theme, 52)}
                tickFormatter={(v) => formatAxisValue(v, 'ms')}
                domain={[0, yMax]}
              />
              <Tooltip
                cursor={tooltipCursor(theme)}
                content={({ active, label, payload }) => (
                  <ChartTooltip
                    active={active}
                    label={label}
                    payload={payload as import('../../../components/charts').TooltipPayloadItem[]}
                    unit="ms"
                    theme={theme}
                    valueFormatter={(v) => String(Math.round(v))}
                  />
                )}
              />
              <Area {...areaProps(theme.primaryColor)} dataKey="latencyMs" />
              <Line {...lineProps(theme.primaryColor)} dataKey="latencyMs" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2">
            <ChartStatsLegend
              series={[{
                label: '응답 시간',
                color: theme.primaryColor,
                values: chartData.map((p) => p.latencyMs),
              }]}
              unit="ms"
              valueFormatter={(v) => String(Math.round(v))}
            />
          </div>
        </>
      )}
    </div>
  );
}
