import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { GlobalTimeRange } from '../../../components/common';
import {
  CHART_INITIAL_DIMENSION, ChartStatsLegend, ChartTooltip, chartCardClass, formatAxisValue, getChartTheme,
  getSeriesPalette, getSeriesDash, gridProps, lineProps, tooltipCursor, xAxisProps, yAxisProps,
} from '../../../components/charts';
import { api, type OtelMetricName, type OtelMetricPoint } from '../../../services/api';

const MAX_SERIES = 6;
const RANGE_HOURS: Record<GlobalTimeRange, number> = { '1h': 1, '6h': 6, '24h': 24 };

type MetricSource =
  | { kind: 'agent'; agentId: string; serviceKey: string }
  | { kind: 'direct'; observedServiceId: string };

interface CommonProps {
  refreshKey?: number;
  range: GlobalTimeRange;
}

interface AgentProps extends CommonProps {
  agentId: string;
  serviceKey: string;
}

interface DirectProps extends CommonProps {
  observedServiceId: string;
}

function formatMetricValue(value: number, unit: string): string {
  if (unit === 'By') {
    const absolute = Math.abs(value);
    if (absolute >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)}GB`;
    if (absolute >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}MB`;
    if (absolute >= 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${Math.round(value)}B`;
  }
  return formatAxisValue(value, unit);
}

function seriesLabel(attributes?: Record<string, unknown>): string {
  const entries = Object.entries(attributes ?? {});
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key.split('.').pop()}=${String(value)}`).join(', ');
}

function ServiceMetricsPanel({ source, refreshKey, range }: CommonProps & { source: MetricSource }) {
  const [names, setNames] = useState<OtelMetricName[]>([]);
  const [namesLoading, setNamesLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [points, setPoints] = useState<OtelMetricPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);

  const agentId = source.kind === 'agent' ? source.agentId : '';
  const serviceKey = source.kind === 'agent' ? source.serviceKey : '';
  const observedServiceId = source.kind === 'direct' ? source.observedServiceId : '';

  useEffect(() => {
    const loadNames = async () => {
      setNamesLoading(true);
      try {
        const list = source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricNames(agentId, serviceKey)
          : await api.getObservedServiceOtelMetricNames(observedServiceId);
        setNames(list);
        setSelected(previous => list.some(item => item.metricName === previous) ? previous : (list[0]?.metricName ?? ''));
      } catch {
        setNames([]);
        setSelected('');
      } finally {
        setNamesLoading(false);
      }
    };
    void loadNames();
  }, [source.kind, agentId, serviceKey, observedServiceId, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    const loadPoints = async () => {
      setPointsLoading(true);
      const from = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
      try {
        setPoints(source.kind === 'agent'
          ? await api.getAgentServiceOtelMetricPoints(agentId, serviceKey, { name: selected, from })
          : await api.getObservedServiceOtelMetricPoints(observedServiceId, { name: selected, from }));
      } catch {
        setPoints([]);
      } finally {
        setPointsLoading(false);
      }
    };
    void loadPoints();
  }, [source.kind, agentId, serviceKey, observedServiceId, selected, range, refreshKey]);

  const selectedMeta = names.find(item => item.metricName === selected);
  const { chartData, seriesKeys, truncatedSeries } = useMemo(() => {
    const keys: string[] = [];
    for (const point of points) {
      const label = seriesLabel(point.attributes);
      if (!keys.includes(label)) keys.push(label);
    }
    const kept = keys.slice(0, MAX_SERIES);
    const rows = new Map<string, Record<string, number | string>>();
    for (const point of points) {
      const label = seriesLabel(point.attributes);
      if (!kept.includes(label)) continue;
      const timeLabel = new Date(point.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const row = rows.get(point.createdAt) ?? { timeLabel };
      row[label || 'value'] = point.value;
      rows.set(point.createdAt, row);
    }
    return {
      chartData: [...rows.values()],
      seriesKeys: kept.map(key => key || 'value'),
      truncatedSeries: keys.length - kept.length,
    };
  }, [points]);

  const theme = getChartTheme();
  const seriesColors = getSeriesPalette(theme);
  const unit = selectedMeta?.unit ?? '';

  if (namesLoading) return <div className="h-64 animate-pulse rounded-xl bg-ui-hover" />;
  if (names.length === 0) {
    return (
      <div className="rounded-xl border border-ui-border bg-bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">수신한 메트릭이 없습니다. OpenTelemetry SDK가 메트릭을 보내면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`p-6 ${chartCardClass}`}>
        <div className="mb-6 flex min-w-0 flex-wrap items-center gap-3">
          <span className="truncate font-mono text-sm font-semibold text-text-base">{selected}</span>
          {selectedMeta && (
            <span className="shrink-0 rounded-full bg-ui-hover px-2 py-0.5 text-xs text-text-muted">
              {selectedMeta.metricType}{unit ? ` · ${unit}` : ''}
            </span>
          )}
        </div>

        {pointsLoading ? (
          <div className="h-64 animate-pulse rounded bg-ui-hover" />
        ) : chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-text-dim">데이터 없음</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={256} initialDimension={CHART_INITIAL_DIMENSION}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridProps(theme)} />
                <XAxis dataKey="timeLabel" {...xAxisProps(theme)} />
                <YAxis {...yAxisProps(theme, 64)} tickFormatter={value => formatMetricValue(value, unit)} />
                <Tooltip
                  cursor={tooltipCursor(theme)}
                  content={({ active, label, payload }) => (
                    <ChartTooltip
                      active={active}
                      label={label}
                      payload={payload as import('../../../components/charts').TooltipPayloadItem[]}
                      unit={unit === 'By' ? '' : unit}
                      theme={theme}
                      valueFormatter={value => unit === 'By' ? formatMetricValue(value, unit) : String(Math.round(value * 100) / 100)}
                    />
                  )}
                />
                {seriesKeys.map((key, index) => (
                  <Line key={key} {...lineProps(seriesColors[index % seriesColors.length])} strokeDasharray={getSeriesDash(index)} dataKey={key} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-2">
              <ChartStatsLegend
                series={seriesKeys.map((key, index) => ({
                  label: key,
                  color: seriesColors[index % seriesColors.length],
                  values: chartData.map(row => Number(row[key])),
                }))}
                unit={unit === 'By' ? '' : unit}
                valueFormatter={value => unit === 'By' ? formatMetricValue(value, unit) : String(Math.round(value * 100) / 100)}
              />
            </div>
            {truncatedSeries > 0 && <p className="mt-2 text-xs text-text-dim">{`속성 조합이 많아 상위 ${MAX_SERIES}개 시리즈만 표시합니다. (+${truncatedSeries}개 생략)`}</p>}
          </>
        )}
      </div>

      <div className="rounded-xl border border-ui-border bg-bg-surface p-6">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-base text-text-base">전체 시리즈</h3>
          <span className="text-xs text-text-dim">행을 선택해 차트에 표시</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-ui-border-soft text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              <th className="py-1.5 pr-3 font-semibold">시리즈</th>
              <th className="py-1.5 pr-3 font-semibold">유형</th>
              <th className="py-1.5 pr-3 font-semibold">단위</th>
              <th className="py-1.5 text-right font-semibold">마지막 수신</th>
            </tr></thead>
            <tbody>
              {names.map(name => {
                const active = name.metricName === selected;
                return (
                  <tr
                    key={`${name.metricName}:${name.metricType}`}
                    tabIndex={0}
                    aria-current={active || undefined}
                    onClick={() => setSelected(name.metricName)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelected(name.metricName);
                      }
                    }}
                    className={`cursor-pointer border-b border-ui-border-soft/50 transition-colors last:border-0 ${active ? 'bg-primary/5' : 'hover:bg-ui-hover-soft'}`}
                  >
                    <td className={`py-2 pr-3 font-mono text-xs ${active ? 'font-semibold text-primary' : 'text-text-secondary'}`}>{name.metricName}</td>
                    <td className="py-2 pr-3 text-xs text-text-muted">{name.metricType}</td>
                    <td className="py-2 pr-3 text-xs text-text-muted">{name.unit || '—'}</td>
                    <td className="whitespace-nowrap py-2 text-right font-mono text-xs text-text-dim">{new Date(name.lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
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

export function AgentServiceMetricsTab({ agentId, serviceKey, ...common }: AgentProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'agent', agentId, serviceKey }} />;
}

export function DirectServiceMetricsTab({ observedServiceId, ...common }: DirectProps) {
  return <ServiceMetricsPanel {...common} source={{ kind: 'direct', observedServiceId }} />;
}
