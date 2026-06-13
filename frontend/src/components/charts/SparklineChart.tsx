import { useId } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line } from 'recharts';
import { getCSSVariable } from '../../design-tokens/colors';

interface SparklineChartProps {
  data: number[];
  color?: string;
}

export function SparklineChart({ data, color = getCSSVariable('primary') }: SparklineChartProps) {
  const rawId = useId();
  const chartData = data.map((v) => ({ v }));
  const gradientId = `sparkline-chart-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="h-12 w-full overflow-hidden rounded-lg bg-slate-50/70 dark:bg-ui-hover-dark/40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="65%" stopColor={color} stopOpacity={0.06} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotoneX"
            dataKey="v"
            stroke="none"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
          <Line
            type="monotoneX"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
