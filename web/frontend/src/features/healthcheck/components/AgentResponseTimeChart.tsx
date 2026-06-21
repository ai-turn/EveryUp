import { useState, useEffect } from 'react';
import { useTranslate } from '@tolgee/react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChartTooltip, formatAxisValue, getChartTheme } from '../../../components/charts';
import { api, type ServiceHistoryPoint } from '../../../services/api';

const PRIMARY = '#3b76c9';

type TimeRange = '6h' | '12h' | '24h';

interface AgentResponseTimeChartProps {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
}

interface ChartPoint {
  latencyMs: number;
  timeLabel: string;
}

export function AgentResponseTimeChart({ agentId, serviceKey, refreshKey }: AgentResponseTimeChartProps) {
  const { t } = useTranslate();
  const [range, setRange] = useState<TimeRange>('24h');
  const [points, setPoints] = useState<ServiceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAgentServiceHistory(agentId, serviceKey, range)
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, range, refreshKey]);

  const theme = getChartTheme();

  const chartData: ChartPoint[] = points.map((p) => ({
    latencyMs: Math.round(p.latencyMs),
    timeLabel: new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }));

  const maxLatency = chartData.length > 0 ? Math.max(...chartData.map((p) => p.latencyMs)) : 0;
  const yMax = Math.max(maxLatency * 1.2, 100);

  const RANGES: { label: string; value: TimeRange }[] = [
    { label: '6H', value: '6h' },
    { label: '12H', value: '12h' },
    { label: '24H', value: '24h' },
  ];

  return (
    <div className="mb-8 p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('응답 시간')}</h3>
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

      {loading ? (
        <div className="h-48 bg-slate-100 dark:bg-ui-hover-dark rounded animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-400 dark:text-text-dim-dark text-sm">
          {t('데이터 없음')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="agentLatencyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
            <XAxis
              dataKey="timeLabel"
              tick={{ fill: theme.tickColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatAxisValue(v, 'ms')}
              tick={{ fill: theme.tickColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[0, yMax]}
              width={52}
            />
            <Tooltip
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
            <Area
              type="monotone"
              dataKey="latencyMs"
              stroke={PRIMARY}
              strokeWidth={2}
              fill="url(#agentLatencyGradient)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="latencyMs"
              stroke={PRIMARY}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
