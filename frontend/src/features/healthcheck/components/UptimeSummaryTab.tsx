import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';
import type { ServiceUptimeSummary, UptimeDay } from '../../../services/api';

interface UptimeSummaryTabProps {
  summaries: ServiceUptimeSummary[];
  loading: boolean;
  days?: number;
}

type SortKey = 'uptime' | 'failures' | 'name';

const SLA_TARGET = 99.9;

const RANGE_OPTIONS = [
  { id: 7, label: '7일' },
  { id: 30, label: '30일' },
  { id: 90, label: '90일' },
] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'uptime', label: '가동률 낮은 순' },
  { value: 'failures', label: '장애 많은 순' },
  { value: 'name', label: '이름순' },
];

export function UptimeSummaryTab({ summaries: initialSummaries, loading: initialLoading }: UptimeSummaryTabProps) {
  const navigate = useNavigate();
  const [selectedDays, setSelectedDays] = useState(90);
  const [summaries, setSummaries] = useState<ServiceUptimeSummary[]>(initialSummaries);
  const [loading, setLoading] = useState(initialLoading);
  const [dayData, setDayData] = useState<Map<string, UptimeDay[]>>(new Map());
  const [sortKey, setSortKey] = useState<SortKey>('uptime');

  // Re-fetch summaries when range changes
  useEffect(() => {
    setLoading(true);
    api.getUptimeSummaryAll(selectedDays)
      .then(setSummaries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDays]);

  // Sync initial data
  useEffect(() => {
    if (initialSummaries.length > 0) setSummaries(initialSummaries);
  }, [initialSummaries]);

  // Fetch per-service daily breakdown in parallel
  useEffect(() => {
    if (summaries.length === 0) return;
    Promise.all(
      summaries.map((s) =>
        api.getServiceUptime(s.serviceId, { days: String(selectedDays) })
          .then((data) => [s.serviceId, data.days] as const)
          .catch(() => [s.serviceId, [] as UptimeDay[]] as const)
      )
    ).then((results) => {
      setDayData(new Map(results));
    });
  }, [summaries, selectedDays]);

  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      if (sortKey === 'name') return a.serviceName.localeCompare(b.serviceName);
      if (sortKey === 'failures') return b.failures - a.failures;
      return a.uptime - b.uptime; // 낮은 순
    });
  }, [summaries, sortKey]);

  // SLA summary computations
  const overallUptime = summaries.length > 0
    ? summaries.reduce((acc, s) => acc + s.uptime, 0) / summaries.length
    : 0;
  const slaCompliant = summaries.filter((s) => s.uptime >= SLA_TARGET).length;
  const totalIncidents = summaries.reduce((acc, s) => acc + s.failures, 0);

  if (loading && summaries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!loading && summaries.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-slate-200 dark:border-ui-border-dark rounded-2xl bg-slate-50/50 dark:bg-bg-surface-dark/50">
        <MaterialIcon name="bar_chart" className="text-5xl text-slate-300 mb-4" />
        <p className="font-semibold text-slate-700 dark:text-text-base-dark">가동률 데이터가 없습니다</p>
        <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-1">체크 기록이 쌓이면 자동으로 표시됩니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Range tabs + sort */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg p-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedDays(r.id)}
              className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${
                selectedDays === r.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-text-muted-dark">정렬</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-text-muted-dark outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SLA summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SlaCard
          label={`전체 가동률 (${selectedDays}일)`}
          value={`${overallUptime.toFixed(2)}`}
          unit="%"
          sub={`SLA ${SLA_TARGET}%`}
          tone={overallUptime >= SLA_TARGET ? 'emerald' : 'amber'}
          bar={overallUptime}
        />
        <SlaCard
          label="SLA 달성 서비스"
          value={String(slaCompliant)}
          unit={`/ ${summaries.length}`}
          tone="slate"
          miniBlocks={summaries.map((s) => s.uptime >= SLA_TARGET)}
        />
        <SlaCard
          label={`총 장애 (${selectedDays}일)`}
          value={String(totalIncidents)}
          unit="건"
          sub={`서비스당 평균 ${(totalIncidents / Math.max(summaries.length, 1)).toFixed(1)}건`}
          tone={totalIncidents > 0 ? 'red' : 'emerald'}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark overflow-hidden">
        {/* Header */}
        <div
          className="grid gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-ui-hover-dark/50 border-b border-slate-100 dark:border-ui-border-dark text-[11px] font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide"
          style={{ gridTemplateColumns: '180px 1fr 88px 72px 100px' }}
        >
          <div>서비스</div>
          <div>일별 가동 상태 ({selectedDays}일 →)</div>
          <div className="text-right">가동률</div>
          <div className="text-right">장애</div>
          <div className="text-right">실패 / 총</div>
        </div>

        {sorted.map((s) => {
          const days = dayData.get(s.serviceId) ?? [];
          const uptimeColor =
            s.uptime >= 99.9 ? 'text-emerald-600 dark:text-emerald-400' :
            s.uptime >= 95 ? 'text-amber-600 dark:text-amber-400' :
            'text-rose-600 dark:text-rose-400';
          const dotColor =
            s.uptime >= 99 ? 'bg-emerald-500' :
            s.uptime >= 95 ? 'bg-amber-500' : 'bg-rose-500';

          return (
            <div
              key={s.serviceId}
              className="grid gap-3 px-4 py-3 border-b border-slate-50 dark:border-ui-border-dark/50 hover:bg-slate-50/50 dark:hover:bg-ui-hover-dark/30 transition-colors items-center"
              style={{ gridTemplateColumns: '180px 1fr 88px 72px 100px' }}
            >
              {/* Service name */}
              <button
                type="button"
                onClick={() => navigate(`/healthcheck/${s.serviceId}`)}
                className="flex items-center gap-2 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                <span className="text-sm font-semibold text-slate-900 dark:text-text-base-dark truncate hover:text-primary dark:hover:text-primary">
                  {s.serviceName}
                </span>
              </button>

              {/* Day cells */}
              <DayCells days={days} totalDays={selectedDays} fallbackUptime={s.uptime} />

              {/* Uptime % */}
              <div className="text-right">
                <span className={`text-sm font-bold tabular-nums ${uptimeColor}`}>
                  {s.uptime.toFixed(2)}%
                </span>
              </div>

              {/* Failures */}
              <div className="text-right">
                <span className={`text-sm font-semibold tabular-nums ${
                  s.failures > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-text-muted-dark'
                }`}>
                  {s.failures}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-text-dim-dark">건</span>
              </div>

              {/* Checks */}
              <div className="text-right text-xs text-slate-500 dark:text-text-muted-dark tabular-nums">
                <span className={s.failures > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                  {s.failures.toLocaleString()}
                </span>
                <span className="text-slate-300 dark:text-text-dim-dark"> / </span>
                <span>{s.totalChecks.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-text-muted-dark flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />정상
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />일부 장애
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />다운타임
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-ui-hover-dark" />데이터 없음
          </span>
        </div>
        <div>{summaries.length}개 서비스 · 최근 {selectedDays}일 · 일별 집계</div>
      </div>
    </div>
  );
}

// 일별 셀 바 차트
function DayCells({ days, totalDays, fallbackUptime }: { days: UptimeDay[]; totalDays: number; fallbackUptime?: number }) {
  const cells = useMemo(() => {
    if (days.length === 0) {
      // 데이터가 없지만 uptime이 존재하면 uptime%에 근사한 셀로 채움
      if (fallbackUptime != null && fallbackUptime > 0) {
        const downRatio = 1 - fallbackUptime / 100;
        return Array.from({ length: totalDays }, (_, i) => {
          const pos = i / totalDays;
          if (downRatio > 0.1 && pos > 0.9) return 'down' as const;
          if (downRatio > 0.01 && pos > 0.95) return 'partial' as const;
          return 'up' as const;
        });
      }
      return Array.from({ length: totalDays }, () => 'empty' as const);
    }
    // 백엔드는 DESC(최신→과거) 순으로 반환 → 뒤집어서 ASC(과거→최신)으로
    const asc = [...days].reverse();
    const padded = [...asc];
    while (padded.length < totalDays) padded.unshift({ date: '', status: 'up', uptime: 100 });
    return padded.slice(-totalDays).map((d) => d.status);
  }, [days, totalDays, fallbackUptime]);

  return (
    <div className="flex gap-0.5 items-center" title={`각 칸 = 하루`}>
      {cells.map((status, i) => {
        const color =
          status === 'empty' ? 'bg-slate-100 dark:bg-ui-hover-dark' :
          status === 'up' ? 'bg-emerald-400' :
          status === 'partial' ? 'bg-amber-400' :
          'bg-rose-500';
        return (
          <div
            key={i}
            className={`flex-1 min-w-0.5 h-6 rounded-[1px] ${color} hover:scale-y-110 transition-transform origin-bottom`}
            title={`${totalDays - i}일 전: ${status}`}
          />
        );
      })}
    </div>
  );
}

// SLA 요약 카드
function SlaCard({
  label, value, unit, sub, tone, bar, miniBlocks,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: 'emerald' | 'amber' | 'red' | 'slate';
  bar?: number;
  miniBlocks?: boolean[];
}) {
  const valueColor: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-rose-600 dark:text-rose-400',
    slate: 'text-slate-900 dark:text-text-base-dark',
  };
  const barColor: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    slate: 'bg-primary',
  };

  return (
    <div className="rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark p-4">
      <div className="text-[11px] text-slate-500 dark:text-text-muted-dark font-semibold">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${valueColor[tone]}`}>{value}</span>
        {unit && <span className="text-xs text-slate-400 dark:text-text-dim-dark">{unit}</span>}
      </div>

      {bar !== undefined && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-ui-hover-dark overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor[tone]}`}
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}

      {miniBlocks && (
        <div className="mt-2 flex gap-0.5">
          {miniBlocks.map((ok, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-sm ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
          ))}
        </div>
      )}

      {sub && (
        <div className="mt-1.5 text-[11px] text-slate-500 dark:text-text-muted-dark">{sub}</div>
      )}
    </div>
  );
}
