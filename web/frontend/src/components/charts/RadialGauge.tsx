import { chartCardClass } from './chartTheme';

interface RadialGaugeProps {
  label: string;
  percentage: number;
  color: string;
  subtitle: string;
  trend: string;
  trendType: 'up' | 'down' | 'stable';
}

export function RadialGauge({
  label,
  percentage,
  color,
  subtitle,
  trend,
  trendType,
}: RadialGaugeProps) {
  const trendColor =
    trendType === 'up' ? 'text-emerald-500' : trendType === 'down' ? 'text-red-400' : 'text-emerald-500';

  return (
    <div className={`flex flex-col items-center justify-center gap-4 p-8 ${chartCardClass}`}>
      <p className="text-slate-500 dark:text-text-muted-dark text-sm font-bold uppercase tracking-widest">
        {label}
      </p>
      <div
        className="relative w-30 h-30 rounded-full flex items-center justify-center transition-all duration-700 ease-out"
        style={{
          background: `conic-gradient(${color} ${percentage}%, var(--color-chart-surface) 0deg)`,
        }}
      >
        <div className="absolute w-22.5 h-22.5 rounded-full bg-white dark:bg-chart-bg" />
        <span className="relative z-10 text-slate-900 dark:text-white text-3xl font-bold">
          {percentage}%
        </span>
      </div>
      <div className="text-center">
        <p className="text-slate-900 dark:text-white font-medium">{subtitle}</p>
        <p className={`${trendColor} text-sm font-bold`}>{trend}</p>
      </div>
    </div>
  );
}
