import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, EmptyState, MaterialIcon } from '../../components/common';
import {
  api,
  type ConnectedAgent,
  type InfrastructureResource,
  type ObservedService,
  type Project,
  type UptimeMonitor,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const FRESH_FOR_MS = 2 * 60 * 1000;
const fresh = (timestamp?: string) => Boolean(timestamp) && Date.now() - new Date(timestamp!).getTime() < FRESH_FOR_MS;

type ProjectData = {
  project: Project | null;
  agents: ConnectedAgent[];
  monitors: UptimeMonitor[];
  observedServices: ObservedService[];
  infrastructure: InfrastructureResource[];
};

function MemberLink({ to, icon, name, detail, state }: { to: string; icon: string; name: string; detail: string; state: 'healthy' | 'warn' | 'error' | 'idle' }) {
  const stateClass = { healthy: 'text-status-healthy', warn: 'text-status-warn', error: 'text-status-error', idle: 'text-status-idle' }[state];
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ui-hover-soft">
      <MaterialIcon name={icon} className={`shrink-0 text-lg ${stateClass}`} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text-base">{name}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{detail}</span></span>
      <MaterialIcon name="chevron_right" className="shrink-0 text-lg text-text-dim" />
    </Link>
  );
}

export function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectData>({ project: null, agents: [], monitors: [], observedServices: [], infrastructure: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    try {
      const [projects, agents, monitors, observedServices, infrastructure] = await Promise.all([
        api.getProjects(), api.getAgents(), api.getUptimeMonitors(), api.getObservedServices(), api.getInfrastructureResources(),
      ]);
      setData({
        project: (projects ?? []).find((project) => project.id === projectId) ?? null,
        agents: (agents ?? []).filter((agent) => agent.projectId === projectId),
        monitors: (monitors ?? []).filter((monitor) => monitor.projectId === projectId),
        observedServices: (observedServices ?? []).filter((service) => service.projectId === projectId),
        infrastructure: (infrastructure ?? []).filter((resource) => resource.projectId === projectId),
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const connectionIssues = useMemo(() => [
    ...data.agents.filter((agent) => !fresh(agent.lastSeenAt)),
    ...data.observedServices.filter((service) => service.isActive && !fresh(service.lastSeenAt)),
    ...data.infrastructure.filter((resource) => resource.isActive && !fresh(resource.lastSeenAt)),
  ].length, [data]);
  const unhealthyMonitors = data.monitors.filter((monitor) => monitor.status === 'unhealthy').length;
  const totalTargets = data.agents.length + data.monitors.length + data.observedServices.length + data.infrastructure.length;

  if (loading) return <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div>;
  if (error) return <EmptyState icon="sync_problem" title="Project를 불러오지 못했습니다" description={error} action={{ label: '다시 시도', onClick: () => void load() }} />;
  if (!data.project) return <EmptyState icon="folder_open" title="Project를 찾을 수 없습니다" action={{ label: 'Projects', onClick: () => navigate('/projects') }} />;

  const directPath = (service: ObservedService) => service.signals.includes('logs') ? `/logs/${service.id}` : service.signals.includes('metrics') ? `/metrics/${service.id}` : `/api/${service.id}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2 text-xs text-text-muted"><Link to="/projects" className="hover:text-primary">Projects</Link><span>/</span></div><h1 className="mt-1 truncate text-2xl font-bold text-text-base">{data.project.name}</h1><p className="mt-1 text-sm text-text-muted">{data.project.description || '이 Project의 모니터링 범위와 현재 이상을 확인하세요.'}</p></div>
        <Button variant="secondary" onClick={() => navigate('/projects')}>Project 관리</Button>
      </div>

      <section aria-label="Project 요약" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ui-border bg-bg-surface p-4"><p className="text-xs text-text-muted">모니터링 대상</p><p className="mt-1 font-mono text-2xl tabular-nums text-text-base">{totalTargets}</p><p className="mt-3 text-xs font-semibold text-text-muted">환경, 모니터, 직접 연결, 인프라</p></div>
        <div className="rounded-xl border border-ui-border bg-bg-surface p-4"><p className="text-xs text-text-muted">수집 확인 필요</p><p className={`mt-1 font-mono text-2xl tabular-nums ${connectionIssues ? 'text-status-warn' : 'text-status-healthy'}`}>{connectionIssues}</p><p className={`mt-3 text-xs ${connectionIssues ? 'text-status-warn' : 'text-status-healthy'}`}>{connectionIssues ? '지연 또는 미확인 대상이 있습니다' : '연결이 모두 최신입니다'}</p></div>
        <div className="rounded-xl border border-ui-border bg-bg-surface p-4"><p className="text-xs text-text-muted">업타임 장애</p><p className={`mt-1 font-mono text-2xl tabular-nums ${unhealthyMonitors ? 'text-status-error' : 'text-status-healthy'}`}>{unhealthyMonitors}</p><p className={`mt-3 text-xs ${unhealthyMonitors ? 'text-status-error' : 'text-status-healthy'}`}>{unhealthyMonitors ? '즉시 확인이 필요한 모니터가 있습니다' : '현재 업타임 장애가 없습니다'}</p></div>
      </section>

      {totalTargets === 0 ? <section className="rounded-xl border border-ui-border bg-bg-surface"><EmptyState icon="folder_open" title="아직 배정된 대상이 없습니다" description="Project 관리 화면에서 환경과 모니터링 대상을 배정하세요." action={{ label: 'Project 관리', onClick: () => navigate('/projects') }} /></section> : (
        <section className="rounded-xl border border-ui-border bg-bg-surface">
          <div className="border-b border-ui-border px-4 py-3.5"><h2 className="text-base text-text-base">대상</h2><p className="mt-0.5 text-sm text-text-muted">서비스 상태와 수집 상태는 대상 상세에서 분리해 확인할 수 있습니다.</p></div>
          <div className="divide-y divide-ui-border-soft">
            {data.agents.map((agent) => <MemberLink key={agent.id} to={`/agents/${agent.id}`} icon="dns" name={agent.name} detail={fresh(agent.lastSeenAt) ? 'Docker 수집기 데이터 유입 중' : 'Docker 수집기 데이터 지연'} state={fresh(agent.lastSeenAt) ? 'healthy' : 'warn'} />)}
            {data.monitors.map((monitor) => <MemberLink key={monitor.id} to={`/uptime/${monitor.id}`} icon="monitor_heart" name={monitor.name} detail={monitor.status === 'unhealthy' ? '업타임 장애' : monitor.status === 'healthy' ? '업타임 정상' : '상태 확인 중'} state={monitor.status === 'unhealthy' ? 'error' : monitor.status === 'healthy' ? 'healthy' : 'idle'} />)}
            {data.observedServices.map((service) => <MemberLink key={service.id} to={directPath(service)} icon="hub" name={service.name} detail={service.isActive ? (fresh(service.lastSeenAt) ? '직접 연결 데이터 유입 중' : '직접 연결 데이터 확인 필요') : '직접 연결이 비활성화됨'} state={service.isActive ? (fresh(service.lastSeenAt) ? 'healthy' : 'warn') : 'idle'} />)}
            {data.infrastructure.map((resource) => <MemberLink key={resource.id} to={`/infrastructure/${resource.id}`} icon="memory" name={resource.name} detail={resource.isActive ? (fresh(resource.lastSeenAt) ? '인프라 데이터 유입 중' : '인프라 데이터 확인 필요') : '인프라 Collector가 비활성화됨'} state={resource.isActive ? (fresh(resource.lastSeenAt) ? 'healthy' : 'warn') : 'idle'} />)}
          </div>
        </section>
      )}
    </div>
  );
}
