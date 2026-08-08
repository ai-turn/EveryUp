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
      {loading ? <div className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" /> : error ? (
        <EmptyState icon="error_outline" title={t('메트릭을 불러오지 못했습니다')} description={error} />
      ) : metrics.length === 0 ? (
        <EmptyState icon="monitoring" title={t('아직 수집된 메트릭이 없습니다')} description={t('메트릭 Agent를 연결한 뒤 OTLP 게이트웨이로 메트릭을 전송하면 여기에 표시됩니다.')} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-ui-border bg-ui-hover-soft"><tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('서비스')}</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('Agent')}</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('메트릭')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">{t('현재 값')}</th>
              </tr></thead>
              <tbody className="divide-y divide-ui-border-soft">
                {metrics.map((metric, index) => <tr key={`${metric.agent.id}:${metric.serviceName}:${metric.metricName}:${index}`} className="hover:bg-ui-hover-soft">
                  <td className="px-4 py-3 text-sm font-medium text-text-base">
                    {metric.service ? <Link to={`/services/${metric.service.agentId}/${encodeURIComponent(metric.service.key)}?tab=metrics`} className="hover:text-primary">{metric.serviceName}</Link> : metric.serviceName}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{metric.agent.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{metric.metricName}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-text-base">{formatMetric(metric.value, metric.unit)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
