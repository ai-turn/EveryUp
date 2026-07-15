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

/* ── EveryUp 차트 스펙 (Grafana풍) ────────────────────────────────
 * 모든 recharts 차트는 아래 팩토리/상수를 사용한다. 개별 차트에서
 * 선 굵기·그리드·축 스타일을 다시 정의하지 말 것.
 * 규칙: 첫 시리즈=프라이머리, monotoneX+둥근 캡, 얇은 1.5px 라인,
 *       평면 10% 채움, 얕은 실선 그리드, semibold 11px 눈금,
 *       애니메이션 없음, 트렌드 차트 범례는 ChartStatsLegend(Last/Min/Max/Avg). */

/** 시리즈 hex 단일 소스 — 정적 컨텍스트(데이터 변환 등)용. 컴포넌트에서는 getSeriesPalette 사용. */
export const SERIES_HEX = {
  primary: '#3b76c9',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  red: '#ef4444',
  teal: '#14b8a6',
} as const;

/** 다중 시리즈 순환 팔레트 — 첫 슬롯은 항상 브랜드 프라이머리. */
export function getSeriesPalette(theme: ChartTheme): string[] {
  return [theme.primaryColor, SERIES_HEX.emerald, SERIES_HEX.amber, SERIES_HEX.violet, SERIES_HEX.red, SERIES_HEX.teal];
}

/** 차트 카드 공통 클래스 — 패딩(p-4/p-6)은 소비처에서 붙인다. */
export const chartCardClass =
  'rounded-xl border border-slate-200 bg-white dark:border-ui-border-dark dark:bg-chart-bg';

export function gridProps(theme: ChartTheme) {
  return { stroke: theme.gridColor, strokeOpacity: 0.55, vertical: false } as const;
}

export function xAxisProps(theme: ChartTheme) {
  return {
    tick: { fill: theme.tickColor, fontSize: 11, fontWeight: 600 },
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    interval: 'preserveStartEnd',
  } as const;
}

export function yAxisProps(theme: ChartTheme, width = 44) {
  return {
    tick: { fill: theme.tickColor, fontSize: 11, fontWeight: 600 },
    tickLine: false,
    axisLine: false,
    width,
  } as const;
}

export function tooltipCursor(theme: ChartTheme) {
  return { stroke: theme.gridColor, strokeWidth: 1, strokeDasharray: '4 4' } as const;
}

export function lineProps(color: string) {
  return {
    type: 'monotoneX',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    dot: false,
    activeDot: { r: 4, stroke: '#ffffff', strokeWidth: 2, fill: color },
    connectNulls: true,
    isAnimationActive: false,
  } as const;
}

/** 라인 아래 평면 10% 채움 — 선은 별도 Line으로 그린다. */
export function areaProps(color: string) {
  return {
    type: 'monotoneX',
    stroke: 'none',
    fill: color,
    fillOpacity: 0.1,
    isAnimationActive: false,
  } as const;
}

/** Grafana풍 스탯 범례 — 트렌드 차트 아래에 시리즈별 Last/Min/Max/Avg를 렌더. */
export function ChartStatsLegend({
  series,
  unit,
  valueFormatter = formatMetricValue,
}: {
  series: { label: string; color: string; values: number[] }[];
  unit: string;
  valueFormatter?: (value: number) => string;
}) {
  const rows = series
    .map((s) => ({ ...s, values: s.values.filter(Number.isFinite) }))
    .filter((s) => s.values.length > 0);
  if (rows.length === 0) return null;

  return (
    <table className="w-full text-2xs tabular-nums">
      <thead>
        <tr className="text-text-dim">
          <th className="py-0.5 text-left font-semibold" />
          <th className="text-right font-semibold">Last</th>
          <th className="text-right font-semibold">Min</th>
          <th className="text-right font-semibold">Max</th>
          <th className="text-right font-semibold">Avg</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const stats: [string, number][] = [
            ['last', s.values[s.values.length - 1]],
            ['min', Math.min(...s.values)],
            ['max', Math.max(...s.values)],
            ['avg', s.values.reduce((sum, v) => sum + v, 0) / s.values.length],
          ];
          return (
            <tr key={s.label} className="text-text-secondary">
              <td className="py-0.5">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
              </td>
              {stats.map(([key, v]) => (
                <td key={key} className="text-right">
                  {valueFormatter(v)}
                  <span className="ml-0.5 text-text-dim">{unit}</span>
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 공용 칩 범례 — recharts <Legend> 대신 차트 위/카드 헤더에 렌더. */
export function ChartLegend({ items, className = '' }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:border-ui-border-dark dark:bg-ui-hover-dark/40 dark:text-text-muted-dark"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function getChartTheme(): ChartTheme {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return {
    gridColor: isDark ? getCssVar('--color-chart-border') || '#334155' : '#e2e8f0',
    tickColor: isDark ? getCssVar('--color-text-muted-dark') || '#94a3b8' : '#94a3b8',
    tooltipBg: isDark ? getCssVar('--color-bg-surface-dark') || '#111827' : '#ffffff',
    tooltipBorder: isDark ? getCssVar('--color-chart-border') || '#334155' : '#e2e8f0',
    primaryColor: getCssVar('--color-primary') || SERIES_HEX.primary,
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
            <span className="inline-flex items-center gap-2 text-text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-bold tabular-nums text-text-base">
              {valueFormatter(Number(item.value) || 0)}
              <span className="ml-0.5 text-xs font-semibold text-text-dim">{unit}</span>
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
