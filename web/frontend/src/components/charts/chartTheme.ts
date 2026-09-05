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

// Recharts otherwise renders once with its -1×-1 sentinel before the first
// ResizeObserver callback, which produces a console warning in lazy routes.
export const CHART_INITIAL_DIMENSION = { width: 1, height: 1 } as const;

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

/* 시리즈 hex 단일 소스 — 정적 컨텍스트(데이터 변환 등)용. 컴포넌트에서는 getSeriesPalette 사용.
 *
 * 500단계였을 때 라이트 배경 대비가 emerald 2.54 / teal 2.49 / amber 2.15로 WCAG 1.4.11(3:1)
 * 미달이었다 — 팔레트가 다크 배경만 보고 튜닝돼 있었다. 600단계로 내려 양쪽 다 통과시킨다.
 *
 * 적록색각이상 하에서 앞 3슬롯(primary/emerald/amber)은 서로 구분되지만 4슬롯째부터는
 * 어떤 순서로 배열해도 충돌한다(primary/violet 16.0, emerald/teal 11.8, amber/red 12.8).
 * 시리즈가 4개를 넘으면 색만으로 구분이 보장되지 않는다 — 선 스타일이나 직접 라벨 병행. */
export const SERIES_HEX = {
  primary: '#3b76c9',
  emerald: '#059669',
  amber: '#d97706',
  violet: '#7c3aed',
  red: '#dc2626',
  teal: '#0d9488',
} as const;

/** 다중 시리즈 순환 팔레트 — 첫 슬롯은 항상 브랜드 프라이머리. */
export function getSeriesPalette(theme: ChartTheme): string[] {
  return [theme.primaryColor, SERIES_HEX.emerald, SERIES_HEX.amber, SERIES_HEX.violet, SERIES_HEX.red, SERIES_HEX.teal];
}

/* 4슬롯째부터 선 스타일을 달리한다 — 그 지점부터 색만으로는 구분이 보장되지 않기 때문이다(위 주석).
 * 앞 3슬롯은 적록색각이상에서도 서로 구분되므로 실선을 유지해, 시리즈가 1~3개인 대다수 차트의
 * 모습은 그대로 둔다. 시리즈 개수가 데이터에 달린 차트에서만 4번째 이후가 파선으로 갈린다. */
const DASH_PATTERNS = ['6 3', '2 2', '8 3 2 3'] as const;

export function getSeriesDash(index: number): string | undefined {
  return index < 3 ? undefined : DASH_PATTERNS[(index - 3) % DASH_PATTERNS.length];
}

/** 차트 카드 공통 클래스 — 패딩(p-4/p-6)은 소비처에서 붙인다. */
export const chartCardClass =
  'rounded-xl border border-ui-border bg-bg-surface';

export function gridProps(theme: ChartTheme) {
  return { stroke: theme.gridColor, strokeOpacity: 0.55, vertical: false } as const;
}

export function xAxisProps(theme: ChartTheme) {
  return {
    tick: { fill: theme.tickColor, fontSize: 12, fontWeight: 500 },
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    interval: 'preserveStartEnd',
  } as const;
}

export function yAxisProps(theme: ChartTheme, width = 44) {
  return {
    tick: { fill: theme.tickColor, fontSize: 12, fontWeight: 500 },
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

export function getChartTheme(): ChartTheme {
  return {
    gridColor: getCssVar('--color-chart-border') || '#e2e8f0',
    // text-muted is the AA-safe chart label token in both themes. Never read
    // the implementation-only *-dark variables here.
    tickColor: getCssVar('--color-text-muted') || '#475569',
    tooltipBg: getCssVar('--color-bg-surface') || '#ffffff',
    tooltipBorder: getCssVar('--color-chart-border') || '#e2e8f0',
    primaryColor: getCssVar('--color-primary') || SERIES_HEX.primary,
  };
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
