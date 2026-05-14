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
    trendType === 'up' ? 'text-lime-400' : trendType === 'down' ? 'text-red-400' : 'text-lime-400';

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl p-8 border border-slate-300 dark:border-chart-border bg-slate-50 dark:bg-bg-surface-dark/50">
      <p className="text-slate-500 dark:text-text-muted-dark text-sm font-bold uppercase tracking-widest">
        {label}
      </p>
      <div
        className="relative w-30 h-30 rounded-full flex items-center justify-center transition-all duration-700 ease-out"
        style={{
          background: `conic-gradient(${color} ${percentage}%, var(--color-chart-surface) 0deg)`,
        }}
      >
        <div className="absolute w-22.5 h-22.5 rounded-full bg-slate-50 dark:bg-chart-bg" />
        <span className="relative z-10 text-slate-900 dark:text-white text-3xl font-bold">
          {percentage}%
        </span>
      </div>
      <div className="text-center">
        <p className="text-slate-900 dark:text-white font-medium">{subtitle}</p>
        <p className={`${trendColor} text-xs font-bold`}>{trend}</p>
      </div>
    </div>
  );
}
