import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { EmptyState, PageHeader } from '../../components/common';
import { api, type AgentServiceFlat, type ConnectedAgent, type OtelServiceMetric } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { CapabilityAgentSetup } from '../../features/services/components/CapabilityAgentSetup';

interface MetricRow extends OtelServiceMetric {
  agent: ConnectedAgent;
  service?: AgentServiceFlat;
}

const METRIC_SKELETONS = ['metric-1', 'metric-2', 'metric-3', 'metric-4', 'metric-5', 'metric-6'];

function formatMetric(value: number, unit?: string) {
  const formatted = Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function MetricsPage() {
  const { t } = useTranslate();
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getAgents(), api.getAllAgentServicesFlat()])
      .then(async ([agents, services]) => {
        const servicesByName = new Map(services.map((service) => [`${service.agentId}:${service.name}`, service]));
        const result = await Promise.all(agents.map(async (agent) => {
          const items = await api.getAgentServiceMetrics(agent.id);
          return items.map((metric) => ({ ...metric, agent, service: servicesByName.get(`${agent.id}:${metric.serviceName}`) }));
        }));
        if (alive) setMetrics(result.flat());
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <PageHeader title={t('메트릭')} subtitle={t('메트릭 프로필 Agent의 OTLP 게이트웨이로 수집된 서비스별 대표 메트릭입니다.')}>
        <CapabilityAgentSetup capability="metrics" />
      </PageHeader>
      {loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {METRIC_SKELETONS.map((item) => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
      </div> : error ? (
        <EmptyState icon="error_outline" title={t('메트릭을 불러오지 못했습니다')} description={error} />
      ) : metrics.length === 0 ? (
        <EmptyState icon="monitoring" title={t('아직 수집된 메트릭이 없습니다')} description={t('메트릭 Agent를 연결한 뒤 OTLP 게이트웨이로 메트릭을 전송하면 여기에 표시됩니다.')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => {
            const key = `${metric.agent.id}:${metric.serviceName}:${metric.metricName}:${metric.metricType}`;
            const content = <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 truncate text-base font-bold text-text-base group-hover:text-primary">{metric.serviceName}</h2>
                <span className="shrink-0 text-xs text-text-muted">{metric.agent.name}</span>
              </div>
              <p className="mt-4 break-all font-mono text-xs text-text-muted">{metric.metricName}</p>
              <div className="mt-6 flex items-end justify-between gap-3">
                <span className="text-xs font-medium text-text-muted">{t('현재 값')}</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-text-base">{formatMetric(metric.value, metric.unit)}</span>
              </div>
            </>;

            return metric.service ? (
              <Link key={key} to={`/services/${metric.service.agentId}/${encodeURIComponent(metric.service.key)}?tab=metrics`} className="group rounded-xl border border-ui-border bg-bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-ui-hover-soft">
                {content}
              </Link>
            ) : (
              <article key={key} className="rounded-xl border border-ui-border bg-bg-surface p-4">
                {content}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
