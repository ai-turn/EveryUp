import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { Button, EmptyState, MaterialIcon, PageHeader } from '../../components/common';
import {
  api,
  type AgentServiceFlat,
  type ConnectedAgent,
  type InfrastructureResource,
  type ObservedService,
  type Project,
  type UptimeMonitor,
} from '../../services/api';

const FRESH_FOR_MS = 2 * 60 * 1000;

function isFresh(timestamp?: string) {
  return Boolean(timestamp) && Date.now() - new Date(timestamp!).getTime() < FRESH_FOR_MS;
}

function SummaryCard({ icon, label, value, detail, tone = 'idle' }: {
  icon: string;
  label: string;
  value: number;
  detail: string;
  tone?: 'healthy' | 'warn' | 'error' | 'idle';
}) {
  const toneClass = {
    healthy: 'text-status-healthy',
    warn: 'text-status-warn',
    error: 'text-status-error',
    idle: 'text-status-idle',
  }[tone];

  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-text-base">{value}</p>
        </div>
        <MaterialIcon name={icon} className={`text-xl ${toneClass}`} />
      </div>
      <p className={`mt-3 text-xs font-semibold ${toneClass}`}>{detail}</p>
    </article>
  );
}

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  to: string;
  tone: 'warn' | 'error';
  icon: string;
}

export function OverviewPage() {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [observedServices, setObservedServices] = useState<ObservedService[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [agentsResult, servicesResult, monitorsResult, projectsResult, observedResult, infrastructureResult] = await Promise.allSettled([
      api.getAgents(),
      api.getAllAgentServicesFlat(),
      api.getUptimeMonitors(),
      api.getProjects(),
      api.getObservedServices(),
      api.getInfrastructureResources(),
    ]);
    const failed: string[] = [];
    if (agentsResult.status === 'fulfilled') setAgents(agentsResult.value ?? []); else failed.push('agents');
    if (servicesResult.status === 'fulfilled') setServices(servicesResult.value ?? []); else failed.push('services');
    if (monitorsResult.status === 'fulfilled') setMonitors(monitorsResult.value ?? []); else failed.push('monitors');
    if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value ?? []); else failed.push('projects');
    if (observedResult.status === 'fulfilled') setObservedServices(observedResult.value ?? []); else failed.push('observed');
    if (infrastructureResult.status === 'fulfilled') setInfrastructure(infrastructureResult.value ?? []); else failed.push('infrastructure');
    setFailedSources(failed);
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const intervalId = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(intervalId);
    };
  }, [load]);

  const reportingAgents = agents.filter((agent) => isFresh(agent.lastSeenAt));
  const staleAgents = agents.filter((agent) => !isFresh(agent.lastSeenAt));
  const unhealthyServices = services.filter((service) => !service.healthy);
  const unhealthyMonitors = monitors.filter((monitor) => monitor.status === 'unhealthy');
  const directAwaitingData = observedServices.filter((service) => service.isActive && !isFresh(service.lastSeenAt));
  const inactiveInfrastructure = infrastructure.filter((resource) => resource.isActive && !isFresh(resource.lastSeenAt));

  const attention = useMemo<AttentionItem[]>(() => [
    ...unhealthyServices.map((service) => ({
      id: `service-${service.agentId}-${service.key}`,
      title: service.name,
      detail: t('서비스 건강 상태가 장애입니다'),
      to: `/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=uptime`,
      tone: 'error' as const,
      icon: 'error_outline',
    })),
    ...unhealthyMonitors.map((monitor) => ({
      id: `monitor-${monitor.id}`,
      title: monitor.name,
      detail: t('업타임 모니터가 장애를 보고했습니다'),
      to: `/uptime/${monitor.id}`,
      tone: 'error' as const,
      icon: 'error_outline',
    })),
    ...staleAgents.map((agent) => ({
      id: `agent-${agent.id}`,
      title: agent.name,
      detail: t('Docker 수집기 데이터가 지연되었거나 끊겼습니다'),
      to: `/agents/${agent.id}`,
      tone: 'warn' as const,
      icon: 'sensors_off',
    })),
    ...directAwaitingData.map((service) => ({
      id: `observed-${service.id}`,
      title: service.name,
      detail: t('직접 연결한 서비스에서 아직 데이터가 확인되지 않았습니다'),
      to: `/logs/${service.id}`,
      tone: 'warn' as const,
      icon: 'schedule',
    })),
    ...inactiveInfrastructure.map((resource) => ({
      id: `infrastructure-${resource.id}`,
      title: resource.name,
      detail: t('인프라 Collector 데이터가 지연되었거나 끊겼습니다'),
      to: `/infrastructure/${resource.id}`,
      tone: 'warn' as const,
      icon: 'sensors_off',
    })),
  ], [directAwaitingData, inactiveInfrastructure, staleAgents, t, unhealthyMonitors, unhealthyServices]);

  const totalTargets = agents.length + monitors.length + observedServices.length + infrastructure.length;
  const connectionIssues = staleAgents.length + directAwaitingData.length + inactiveInfrastructure.length;

  if (loading && totalTargets === 0) {
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('모니터링 개요')} subtitle={t('수집 상태와 현재 이상을 먼저 확인하세요.')}>
        <Button onClick={() => navigate('/environments')}>
          <MaterialIcon name="add" className="text-base" />
          {t('모니터링 시작')}
        </Button>
      </PageHeader>

      {failedSources.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-3">
            <MaterialIcon name="sync_problem" className="mt-0.5 text-lg text-status-warn" />
            <div>
              <p className="text-sm font-semibold text-text-base">{t('일부 모니터링 정보를 불러오지 못했습니다')}</p>
              <p className="mt-0.5 text-xs text-text-muted">{t('성공한 영역은 계속 표시합니다. 다시 시도해 최신 상태를 확인하세요.')}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load()}>{t('다시 시도')}</Button>
        </section>
      )}

      {totalTargets === 0 ? (
        <section className="rounded-xl border border-ui-border bg-bg-surface">
          <EmptyState
            icon="sensors"
            title={t('아직 모니터링 대상이 없습니다')}
            description={t('Docker 환경, 업타임 모니터 또는 직접 OpenTelemetry 연결 중 하나를 선택해 시작하세요.')}
            action={{ label: t('모니터링 시작'), onClick: () => navigate('/environments') }}
          />
        </section>
      ) : (
        <>
          <section aria-label={t('수집 상태 요약')} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon="sensors" label={t('Docker 수집기')} value={agents.length} detail={reportingAgents.length === agents.length ? t('모두 데이터 유입 중') : `${staleAgents.length}${t('개 연결 확인 필요')}`} tone={reportingAgents.length === agents.length ? 'healthy' : 'warn'} />
            <SummaryCard icon="dns" label={t('서비스')} value={services.length + monitors.length + observedServices.length} detail={unhealthyServices.length + unhealthyMonitors.length === 0 ? t('현재 건강 상태 이상 없음') : `${unhealthyServices.length + unhealthyMonitors.length}${t('개 장애 신호')}`} tone={unhealthyServices.length + unhealthyMonitors.length === 0 ? 'healthy' : 'error'} />
            <SummaryCard icon="account_tree" label="Projects" value={projects.length} detail={projects.length > 0 ? t('대상을 운영 단위로 묶고 있습니다') : t('필요할 때 대상들을 묶어 보세요')} tone={projects.length > 0 ? 'healthy' : 'idle'} />
            <SummaryCard icon="sensors_off" label={t('수집 확인 필요')} value={connectionIssues} detail={connectionIssues === 0 ? t('모든 연결이 최신 상태입니다') : t('지연 또는 미확인 대상을 확인하세요')} tone={connectionIssues === 0 ? 'healthy' : 'warn'} />
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <article className="rounded-xl border border-ui-border bg-bg-surface">
              <div className="flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3.5">
                <div>
                  <h2 className="text-base font-bold text-text-base">{t('현재 확인 필요')}</h2>
                  <p className="mt-0.5 text-xs text-text-muted">{t('서비스 건강과 수집 상태를 분리해 보여줍니다.')}</p>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-text-muted">{attention.length}</span>
              </div>
              {attention.length === 0 ? (
                <div className="flex min-h-44 flex-col items-center justify-center p-5 text-center">
                  <MaterialIcon name="check_circle" className="text-3xl text-status-healthy" />
                  <p className="mt-3 text-sm font-semibold text-text-base">{t('현재 확인이 필요한 이상이 없습니다')}</p>
                  <p className="mt-1 text-xs text-text-muted">{t('수집 연결과 서비스 건강 상태가 최신입니다.')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-ui-border-soft">
                  {attention.slice(0, 6).map((item) => (
                    <li key={item.id}>
                      <Link to={item.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
                        <MaterialIcon name={item.icon} className={`shrink-0 text-lg ${item.tone === 'error' ? 'text-status-error' : 'text-status-warn'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text-base">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-text-muted">{item.detail}</span>
                        </span>
                        <MaterialIcon name="chevron_right" className="shrink-0 text-lg text-text-dim" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
              <h2 className="text-base font-bold text-text-base">{t('모니터링 범위')}</h2>
              <p className="mt-1 text-xs text-text-muted">{t('연결 방식별로 수집 범위를 확인하세요.')}</p>
              <dl className="mt-4 space-y-3">
                {[
                  [t('Docker 환경'), agents.length, '/environments'],
                  [t('업타임 모니터'), monitors.length, '/uptime'],
                  [t('직접 연결 서비스'), observedServices.length, '/logs'],
                  [t('인프라 리소스'), infrastructure.length, '/infrastructure'],
                ].map(([label, count, to]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-text-secondary">{label}</dt>
                    <dd><Link to={String(to)} className="font-mono text-sm font-bold tabular-nums text-primary hover:underline">{count}</Link></dd>
                  </div>
                ))}
              </dl>
              <Link to="/projects" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                {t('Project로 대상 정리하기')} <MaterialIcon name="arrow_forward" className="text-sm" />
              </Link>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
