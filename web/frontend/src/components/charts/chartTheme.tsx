import type { ReactNode } from 'react';

export interface ChartTheme {
  gridColor: string;
  tickColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  /** Brand primary for chart series — follows the light/dark CSS token. */
  primaryColor: string;
}

export interface TooltipPayloadItem {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  unit: string;
  theme: ChartTheme;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label?: string | number) => ReactNode;
}

function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartTheme(): ChartTheme {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return {
    gridColor: isDark ? getCssVar('--color-chart-border') || '#334155' : '#e2e8f0',
    tickColor: isDark ? getCssVar('--color-text-muted-dark') || '#94a3b8' : '#94a3b8',
    tooltipBg: isDark ? getCssVar('--color-bg-surface-dark') || '#111827' : '#ffffff',
    tooltipBorder: isDark ? getCssVar('--color-chart-border') || '#334155' : '#e2e8f0',
    primaryColor: getCssVar('--color-primary') || '#3b76c9',
  };
}

export function ChartTooltip({
  active,
  label,
  payload,
  unit,
  theme,
  valueFormatter = formatMetricValue,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const seen = new Set<string>();
  const rows = payload.filter((item) => {
    const key = String(item.dataKey ?? item.name ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div
      className="min-w-36 rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{
        background: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
      }}
    >
      <p className="mb-2 text-xs font-bold" style={{ color: theme.tickColor }}>
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div className="space-y-1.5">
        {rows.map((item) => (
          <div key={String(item.dataKey ?? item.name)} className="flex items-center justify-between gap-5">
            <span className="inline-flex items-center gap-2 text-slate-500 dark:text-text-muted-dark">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-white">
              {valueFormatter(Number(item.value) || 0)}
              <span className="ml-0.5 text-xs font-semibold text-slate-400 dark:text-text-dim-dark">{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function getYAxisMax(chart: { unit: string; yMax?: number }, values: number[]): number {
  if (chart.yMax !== undefined) return chart.yMax;

  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  const padded = Math.max(maxValue * 1.16, 1);

  if (chart.unit === '%') return Math.min(100, Math.ceil(padded / 10) * 10);
  if (padded >= 100) return Math.ceil(padded / 25) * 25;
  if (padded >= 10) return Math.ceil(padded / 5) * 5;
  if (padded >= 1) return Math.ceil(padded * 10) / 10;
  return Math.ceil(padded * 100) / 100;
}

export function formatAxisValue(value: number, unit?: string): string {
  if (unit === '%') return String(Math.round(value));
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Math.abs(value) >= 10) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

export function formatMetricValue(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
