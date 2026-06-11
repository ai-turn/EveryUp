import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { Sparkline } from '../../../components/common/Sparkline';
import { useMonitoringGauges, useMonitoringTrends } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { GaugeData } from '../../../types/infra';

interface InfraGaugesProps {
  hostId: string;
  refreshKey?: number;
}

// 게이지 레이블 → 트렌드 데이터 키 매핑
const GAUGE_TREND_KEY: Record<string, string> = {
  'CPU':     'cpu',
  'Memory':  'memUsed',
  'Disk':    'diskRead',
  'Network': 'netIn',
};

export function InfraGauges({ hostId, refreshKey = 0 }: InfraGaugesProps) {
  const { data: gauges, loading } = useMonitoringGauges(hostId, refreshKey);
  const { data: charts } = useMonitoringTrends(hostId, '6h', refreshKey);

  // 각 게이지에 대한 스파크라인 데이터 (최근 12포인트 = 약 1h)
  const sparklineMap = useMemo(() => {
    if (!charts) return {} as Record<string, number[]>;
    const map: Record<string, number[]> = {};
    for (const [gaugeLabel, trendKey] of Object.entries(GAUGE_TREND_KEY)) {
      for (const chart of charts) {
        const series = chart.series.find((s) => s.key === trendKey);
        if (series) {
          map[gaugeLabel] = chart.data
            .slice(-12)
            .map((p) => Number(p[trendKey]))
            .filter(Number.isFinite);
          break;
        }
      }
    }
    return map;
  }, [charts]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 sm:h-56 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {(gauges || []).map((gauge) => (
        <VitalGaugeCard
          key={gauge.label}
          gauge={gauge}
          sparkline={sparklineMap[gauge.label]}
        />
      ))}
    </div>
  );
}

function VitalGaugeCard({ gauge, sparkline }: { gauge: GaugeData; sparkline?: number[] }) {
  const { t } = useTranslation(['infra']);
  const pct = clampPercent(gauge.percentage);
  const tone = getGaugeTone(pct);
  const trendIcon = gauge.trendType === 'up' ? 'arrow_upward' : gauge.trendType === 'down' ? 'arrow_downward' : 'remove';

  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-ui-border-dark dark:bg-bg-surface-dark sm:p-5">
      {/* 상단: 레이블 + 추세 배지 */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
            {gauge.label}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-text-dim-dark">
            {gauge.subtitle}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${tone.soft} ${tone.text}`}>
          <MaterialIcon name={trendIcon} className="text-sm" />
          {gauge.trend}
        </span>
      </div>

      {/* 링 게이지 + 우측 정보 (모바일은 링만, sm+ 부터 우측 정보 표시) */}
      <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
        <div
          className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${gauge.color} ${pct * 3.6}deg, rgba(148, 163, 184, 0.16) 0deg)`,
          }}
          aria-label={`${gauge.label} ${gauge.displayValue ?? pct}${gauge.displayUnit ?? '%'}`}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-inner dark:bg-bg-surface-dark">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{gauge.displayValue ?? pct}</p>
              <p className="text-xs font-bold uppercase text-slate-400 dark:text-text-dim-dark">{gauge.displayUnit ?? '%'}</p>
            </div>
          </div>
        </div>

        <div className="hidden min-w-0 space-y-2 sm:block sm:flex-1">
          {/* 상태 라벨 */}
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-text-muted-dark">
            <span>{t('infra.detail.load')}</span>
            <span className={tone.text}>{t(`infra.detail.loadStates.${getGaugeState(pct)}`)}</span>
          </div>

          {/* 프로그레스 바 */}
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-ui-hover-dark overflow-hidden">
            <div className={`h-full rounded-full ${tone.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
          </div>

          {/* 스파크라인 (최근 1h 추세) */}
          {sparkline && sparkline.length >= 2 ? (
            <div className="pt-1">
              <p className="text-xs text-slate-400 dark:text-text-dim-dark mb-0.5">1시간 추세</p>
              <Sparkline data={sparkline} width={100} height={24} color={gauge.color} />
            </div>
          ) : (
            <div className="flex gap-1 pt-1">
              {[35, 70, 90].map((mark) => (
                <div key={mark} className={`h-1 flex-1 rounded-full ${pct >= mark ? tone.bar : 'bg-slate-100 dark:bg-ui-hover-dark'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGaugeTone(pct: number) {
  if (pct >= 90) {
    return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', soft: 'bg-red-50 dark:bg-red-500/10' };
  }
  if (pct >= 75) {
    return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', soft: 'bg-amber-50 dark:bg-amber-500/10' };
  }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', soft: 'bg-emerald-50 dark:bg-emerald-500/10' };
}

function getGaugeState(pct: number) {
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'elevated';
  return 'normal';
}
