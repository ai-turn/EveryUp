import { useState, useEffect, useMemo } from 'react';
import { useTranslate } from '@tolgee/react';
import {
  ResponsiveContainer, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import type { GlobalTimeRange } from '../../../components/common';
import { ChartTooltip, formatAxisValue, getChartTheme } from '../../../components/charts';
import { api, type OtelMetricName, type OtelMetricPoint } from '../../../services/api';

// First slot is filled with the theme primary at render time (light/dark aware).
const SERIES_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
const MAX_SERIES = 6;

const RANGE_HOURS: Record<GlobalTimeRange, number> = { '1h': 1, '6h': 6, '24h': 24 };

interface Props {
  agentId: string;
  serviceKey: string;
  refreshKey?: number;
  /** Shared chart range from the page-header picker. */
  range: GlobalTimeRange;
}

// OTel semconv bytes unit ("By") formatted as KB/MB/GB; other units defer to
// the shared axis formatter.
function formatMetricValue(v: number, unit: string): string {
  if (unit === 'By') {
    const abs = Math.abs(v);
    if (abs >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)}GB`;
    if (abs >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)}MB`;
    if (abs >= 1024) return `${(v / 1024).toFixed(1)}KB`;
    return `${Math.round(v)}B`;
  }
  return formatAxisValue(v, unit);
}

// Compact "k=v, k=v" label for one attribute set; empty attrs share one series.
function seriesLabel(attributes?: Record<string, unknown>): string {
  const entries = Object.entries(attributes ?? {});
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k.split('.').pop()}=${String(v)}`).join(', ');
}

export function AgentServiceMetricsTab({ agentId, serviceKey, refreshKey, range }: Props) {
  const { t } = useTranslate();
  const [names, setNames] = useState<OtelMetricName[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [points, setPoints] = useState<OtelMetricPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);

  useEffect(() => {
    setNamesLoading(true);
    api.getAgentServiceOtelMetricNames(agentId, serviceKey)
      .then((list) => {
        setNames(list);
        setSelected((prev) => prev || list[0]?.metricName || '');
      })
      .catch(() => setNames([]))
      .finally(() => setNamesLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    const hours = RANGE_HOURS[range];
    setPointsLoading(true);
    api.getAgentServiceOtelMetricPoints(agentId, serviceKey, {
      name: selected,
      from: new Date(Date.now() - hours * 3600 * 1000).toISOString(),
    })
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setPointsLoading(false));
  }, [agentId, serviceKey, selected, range, refreshKey]);

  const selectedMeta = names.find((n) => n.metricName === selected);

  // Pivot points into one row per timestamp with one column per attribute set.
  const { chartData, seriesKeys, truncatedSeries } = useMemo(() => {
    const keys: string[] = [];
    for (const p of points) {
      const label = seriesLabel(p.attributes);
      if (!keys.includes(label)) keys.push(label);
    }
    const kept = keys.slice(0, MAX_SERIES);
    const rows = new Map<string, Record<string, number | string>>();
    for (const p of points) {
      const label = seriesLabel(p.attributes);
      if (!kept.includes(label)) continue;
      const timeLabel = new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const row = rows.get(p.createdAt) ?? { timeLabel };
      row[label || 'value'] = p.value;
      rows.set(p.createdAt, row);
    }
    return {
      chartData: [...rows.values()],
      seriesKeys: kept.map((k) => k || 'value'),
      truncatedSeries: keys.length - kept.length,
    };
  }, [points]);

  const theme = getChartTheme();
  const seriesColors = [theme.primaryColor, ...SERIES_COLORS];
  const unit = selectedMeta?.unit ?? '';

  if (namesLoading) {
    return <div className="h-64 bg-slate-100 dark:bg-ui-hover-dark rounded-xl animate-pulse" />;
  }

  if (names.length === 0) {
    return (
      <div className="p-8 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark text-center">
        <p className="text-sm text-slate-500 dark:text-text-muted-dark">
          {t('수신된 메트릭이 없습니다. 앱의 OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">{selected}</span>
          {selectedMeta && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark shrink-0">
              {selectedMeta.metricType}{unit ? ` · ${unit}` : ''}
            </span>
          )}
        </div>
      </div>

      {pointsLoading ? (
        <div className="h-64 bg-slate-100 dark:bg-ui-hover-dark rounded animate-pulse" />
      ) : chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-400 dark:text-text-dim-dark text-sm">
          {t('데이터 없음')}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={256}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
              <XAxis
                dataKey="timeLabel"
                tick={{ fill: theme.tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => formatMetricValue(v, unit)}
                tick={{ fill: theme.tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                content={({ active, label, payload }) => (
                  <ChartTooltip
                    active={active}
                    label={label}
                    payload={payload as import('../../../components/charts').TooltipPayloadItem[]}
                    unit={unit === 'By' ? '' : unit}
                    theme={theme}
                    valueFormatter={(v) => (unit === 'By' ? formatMetricValue(v, unit) : String(Math.round(v * 100) / 100))}
                  />
                )}
              />
              {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {seriesKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={seriesColors[i % seriesColors.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          {truncatedSeries > 0 && (
            <p className="mt-2 text-xs text-slate-400 dark:text-text-dim-dark">
              {t('속성 조합이 많아 상위 {count}개 시리즈만 표시합니다 (+{rest}개 생략)', {
                count: MAX_SERIES,
                rest: truncatedSeries,
              })}
            </p>
          )}
        </>
      )}

    </div>

      {/* All exported series — row click swaps the chart (ver2: 전체 시리즈) */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('전체 시리즈')}</h3>
          <span className="text-xs text-slate-400 dark:text-text-dim-dark">{t('행 클릭 → 차트 표시')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark border-b border-slate-100 dark:border-ui-border-dark">
                <th className="py-1.5 pr-3 font-semibold">{t('시리즈')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('타입')}</th>
                <th className="py-1.5 pr-3 font-semibold">{t('단위')}</th>
                <th className="py-1.5 text-right font-semibold">{t('마지막 수신')}</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const active = n.metricName === selected;
                return (
                  <tr
                    key={`${n.metricName}:${n.metricType}`}
                    onClick={() => setSelected(n.metricName)}
                    className={`cursor-pointer border-b border-slate-50 dark:border-ui-border-dark/50 last:border-0 transition-colors ${
                      active
                        ? 'bg-primary/5 dark:bg-primary/10'
                        : 'hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
                    }`}
                  >
                    <td className={`py-2 pr-3 font-mono text-xs ${active ? 'font-semibold text-primary' : 'text-slate-700 dark:text-text-secondary-dark'}`}>
                      {n.metricName}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500 dark:text-text-muted-dark">{n.metricType}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500 dark:text-text-muted-dark">{n.unit || '—'}</td>
                    <td className="py-2 text-right text-xs font-mono text-slate-400 dark:text-text-dim-dark whitespace-nowrap">
                      {new Date(n.lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
