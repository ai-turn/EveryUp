import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Sparkline } from '../../../components/common';
import { api } from '../../../services/api';
import type { HealthCheckKpiSummary } from '../../../services/api';

function KpiBlock({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string | number;
  tone: 'emerald' | 'red' | 'slate' | 'primary';
}) {
  const toneClass: Record<string, string> = {
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    slate: 'text-slate-400 dark:text-text-dim-dark',
    primary: 'text-primary',
  };
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-slate-400 dark:text-text-muted-dark">
        <MaterialIcon name={icon} className="text-sm" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}

interface Props {
  refreshKey?: number;
}

export function HealthCheckKpiHero({ refreshKey = 0 }: Props) {
  const { t } = useTranslation(['healthcheck', 'common']);
  const [kpi, setKpi] = useState<HealthCheckKpiSummary | null>(null);

  useEffect(() => {
    api.getHealthCheckKpiSummary().then(setKpi).catch(() => {});
  }, [refreshKey]);

  if (!kpi) return null;

  const unhealthyCount = kpi.unhealthy + kpi.unknown;

  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl px-6 py-5 mb-6">
      <div className="flex items-center justify-between gap-6 flex-wrap">
        {/* KPI blocks */}
        <div className="flex items-center gap-8 flex-wrap">
          <KpiBlock
            icon="monitor_heart"
            label={t('healthcheck.kpi.total')}
            value={kpi.total}
            tone="primary"
          />
          <KpiBlock
            icon="check_circle"
            label={t('common.healthy')}
            value={kpi.healthy}
            tone="emerald"
          />
          <KpiBlock
            icon="warning"
            label={t('healthcheck.kpi.attention')}
            value={unhealthyCount}
            tone={unhealthyCount > 0 ? 'red' : 'slate'}
          />
          <KpiBlock
            icon="bolt"
            label={t('healthcheck.kpi.avgResponse')}
            value={kpi.total > 0 ? `${Math.round(kpi.avgLatency)}ms` : '-'}
            tone="primary"
          />
          <KpiBlock
            icon="crisis_alert"
            label={t('healthcheck.kpi.incidents')}
            value={kpi.activeIncidents}
            tone={kpi.activeIncidents > 0 ? 'red' : 'slate'}
          />
        </div>

        {/* 24h sparkline */}
        {kpi.latencyHistory.length >= 2 && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-slate-400 dark:text-text-dim-dark uppercase tracking-wide font-semibold">
              24h 응답 시간 추이
            </span>
            <Sparkline data={kpi.latencyHistory} width={120} height={36} color="#3b76c9" />
          </div>
        )}
      </div>

      {kpi.activeIncidents > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ui-border-dark flex items-center gap-2 text-red-500">
          <MaterialIcon name="crisis_alert" className="text-sm" />
          <span className="text-xs font-bold">활성 인시던트 {kpi.activeIncidents}건 진행 중</span>
        </div>
      )}
    </div>
  );
}
