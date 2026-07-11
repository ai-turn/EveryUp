import { ResponsiveContainer, ComposedChart, Area, Line } from 'recharts';
import { getCSSVariable } from '../../design-tokens/colors';
import { areaProps } from './chartTheme';

interface SparklineChartProps {
  data: number[];
  color?: string;
}

export function SparklineChart({ data, color = getCSSVariable('primary') }: SparklineChartProps) {
  const chartData = data.map((v) => ({ v }));

  return (
    <div className="h-12 w-full overflow-hidden rounded-lg bg-slate-50/70 dark:bg-ui-hover-dark/40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Area {...areaProps(color)} dataKey="v" />
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
