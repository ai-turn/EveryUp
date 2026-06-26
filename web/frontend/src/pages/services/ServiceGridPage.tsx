import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../components/common';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { PendingServiceCard } from '../../features/services/components/PendingServiceCard';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'react-hot-toast';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

interface ProjectCardProps {
  agentId: string;
  agent?: ConnectedAgent;
  agentName: string;
  services: AgentServiceFlat[];
  onDeleteAgent: (id: string) => void;
  onViewKey: (agent: ConnectedAgent) => void;
}

// One project (= one agent = one docker-compose host) rendered as a single card.
// Clicking drills into the project detail page that lists its internal services.
function ProjectCard({ agentId, agent, agentName, services, onDeleteAgent, onViewKey }: ProjectCardProps) {
  const navigate = useNavigate();
  const online = agent ? agentOnline(agent) : true;
  const total = services.length;
  const healthy = services.filter(s => s.healthy).length;
  const down = services.filter(s => !s.healthy);
  const allHealthy = down.length === 0;

  return (
    <div
      onClick={() => navigate(`/projects/${agentId}`)}
      className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:translate-y-0 flex flex-col gap-3"
    >
      {/* Header: status + project name + controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <div className="min-w-0">
            <h3 className="font-semibold text-base text-slate-900 dark:text-white truncate leading-tight">{agentName}</h3>
            {agent?.version && (
              <span className="text-xs text-slate-400 dark:text-text-dim-dark">v{agent.version}</span>
            )}
          </div>
        </div>
        {agent && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onViewKey(agent); }}
              title="API 키 보기"
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <MaterialIcon name="key" className="text-base" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent.id); }}
              title="프로젝트 비활성화"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <MaterialIcon name="delete_outline" className="text-base" />
            </button>
          </div>
        )}
      </div>

      {/* Summary: service count + health */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-500 dark:text-text-muted-dark">서비스 {total}개</span>
        <span className={`flex items-center gap-1 text-sm font-semibold ${allHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
          <MaterialIcon name={allHealthy ? 'check_circle' : 'cancel'} className="text-sm" />
          {healthy}/{total} 정상
        </span>
      </div>

      {/* Failing services preview */}
      {down.length > 0 && (
        <p className="text-xs text-red-500 dark:text-red-400 truncate -mt-1">
          장애: {down.map(s => s.name).join(', ')}
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-ui-border-dark" />

      {/* Footer: online state + drill-in hint */}
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 dark:text-text-dim-dark">
        <span>{online ? '온라인' : '오프라인'}</span>
        <span className="flex items-center gap-0.5">
          서비스 보기
          <MaterialIcon name="chevron_right" className="text-sm" />
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslate();
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center">
        <MaterialIcon name="sensors" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold text-slate-700 dark:text-white">
          {t('아직 프로젝트가 없습니다')}
        </p>
        <p className="text-sm text-slate-500 dark:text-text-muted-dark max-w-sm">
          {t('프로젝트를 추가하고 API 키로 에이전트를 연결하세요')}
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <MaterialIcon name="add" className="text-base" />
        프로젝트 추가
      </button>
    </div>
  );
}

export function ServiceGridPage() {
  const { t } = useTranslate();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'healthy' | 'unhealthy'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [keyModalAgent, setKeyModalAgent] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [svcs, agts] = await Promise.all([
        api.getAllAgentServicesFlat(),
        api.getAgents(),
      ]);
      setServices(svcs ?? []);
      setAgents(agts ?? []);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const handleDelete = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!confirm(`'${agent?.name ?? agentId}' 프로젝트를 비활성화하시겠습니까?\n에이전트 연결이 차단되며 수집 데이터는 보존됩니다.`)) return;
    try {
      await api.deleteAgent(agentId);
      toast.success('프로젝트가 비활성화됐습니다');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const reportingAgentIds = new Set(services.map((s) => s.agentId));
  // Agents that exist but haven't reported any service yet — show them as
  // "pending" cards in the main grid so a fresh creation feels like it landed.
  const pendingAgents = agents.filter((a) => !reportingAgentIds.has(a.id));
  const connectedAgents = agents.filter((a) => reportingAgentIds.has(a.id));

  // Group ALL services by project (agent) — one project = one card. Orphan
  // services whose agent row is missing fall back to a synthetic group.
  type ProjectGroup = { agentId: string; agent?: ConnectedAgent; agentName: string; services: AgentServiceFlat[] };
  const byAgent = new Map<string, AgentServiceFlat[]>();
  for (const s of services) {
    const arr = byAgent.get(s.agentId);
    if (arr) arr.push(s);
    else byAgent.set(s.agentId, [s]);
  }
  const allGroups: ProjectGroup[] = [];
  for (const agent of connectedAgents) {
    allGroups.push({ agentId: agent.id, agent, agentName: agent.name, services: byAgent.get(agent.id) ?? [] });
    byAgent.delete(agent.id);
  }
  for (const [agentId, svcs] of byAgent) {
    allGroups.push({ agentId, agentName: svcs[0]?.agentName ?? agentId, services: svcs });
  }

  // Project-level filter + search: a project matches search if its name or any of
  // its services match; health filter looks at whether any service is down.
  const groups = allGroups.filter((g) => {
    const anyDown = g.services.some((s) => !s.healthy);
    if (filter === 'healthy' && anyDown) return false;
    if (filter === 'unhealthy' && !anyDown) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.agentName.toLowerCase().includes(q) ||
      g.services.some((s) => s.name.toLowerCase().includes(q) || s.endpoint.toLowerCase().includes(q))
    );
  });

  // Pending cards have no health, so only show them under the "all" filter.
  const visiblePending = filter === 'all'
    ? pendingAgents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const healthyProjects = allGroups.filter((g) => g.services.every((s) => s.healthy)).length;
  const unhealthyProjects = allGroups.filter((g) => g.services.some((s) => !s.healthy)).length;

  const kpis = [
    { label: t('프로젝트'), value: allGroups.length, color: 'text-slate-900 dark:text-white', filterVal: 'all' as const },
    { label: t('정상'), value: healthyProjects, color: 'text-emerald-600 dark:text-emerald-400', filterVal: 'healthy' as const },
    { label: t('장애'), value: unhealthyProjects, color: unhealthyProjects > 0 ? 'text-red-500' : 'text-slate-400 dark:text-text-dim-dark', filterVal: 'unhealthy' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('서비스')}</h1>
          <p className="text-sm text-slate-500 dark:text-text-muted-dark">
            {t('Agent가 감지한 모니터링 서비스')}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
        >
          <MaterialIcon name="add" className="text-base" />
          프로젝트 추가
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setFilter(f => f === kpi.filterVal ? 'all' : kpi.filterVal)}
            className={`rounded-xl px-4 py-3.5 text-left transition-all border ${
              filter === kpi.filterVal
                ? 'bg-primary/5 border-primary/30 dark:border-primary/40'
                : 'bg-white dark:bg-bg-surface-dark border-slate-200 dark:border-ui-border-dark hover:border-slate-300 dark:hover:border-ui-active-dark'
            }`}
          >
            <p className="text-xs text-slate-500 dark:text-text-muted-dark uppercase tracking-wider mb-1">
              {kpi.label}
            </p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <MaterialIcon
          name="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-text-dim-dark text-lg pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('서비스 또는 프로젝트 이름으로 검색')}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-dim-dark focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 && agents.length === 0 ? (
        <EmptyState onAdd={() => setShowAddModal(true)} />
      ) : groups.length === 0 && visiblePending.length === 0 ? (
        <div className="py-16 text-center text-slate-400 dark:text-text-muted-dark text-sm">
          {t('검색 결과가 없습니다')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <ProjectCard
              key={g.agentId}
              agentId={g.agentId}
              agent={g.agent}
              agentName={g.agentName}
              services={g.services}
              onDeleteAgent={handleDelete}
              onViewKey={(a) => setKeyModalAgent({ id: a.id, name: a.name })}
            />
          ))}
          {visiblePending.map((agent) => (
            <PendingServiceCard
              key={agent.id}
              agent={agent}
              onDelete={handleDelete}
              onViewKey={() => setKeyModalAgent({ id: agent.id, name: agent.name })}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServiceModal
          onClose={() => setShowAddModal(false)}
          onCreated={load}
        />
      )}

      {keyModalAgent && (
        <ApiKeyModal
          agentId={keyModalAgent.id}
          agentName={keyModalAgent.name}
          onClose={() => setKeyModalAgent(null)}
          onRotated={load}
        />
      )}
    </div>
  );
}
