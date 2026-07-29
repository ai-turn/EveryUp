import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { MaterialIcon } from '../../components/common/MaterialIcon';
import { SearchInput } from '../../components/common/SearchInput';
import { api, type AgentOverview, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { PendingServiceCard } from '../../features/services/components/PendingServiceCard';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';
import { activatable } from '../../utils/a11y';
import { toast } from 'react-hot-toast';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

interface ProjectCardProps {
  agentId: string;
  agent?: ConnectedAgent;
  agentName: string;
  services: AgentServiceFlat[];
  overview?: AgentOverview;
  onDeleteAgent: (id: string) => void;
  onViewKey: (agent: ConnectedAgent) => void;
}

// One project (= one agent = one docker-compose host) rendered as a single card.
// Clicking drills into the project detail page that lists its internal services.
function ProjectCard({ agentId, agent, agentName, services, overview, onDeleteAgent, onViewKey }: ProjectCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslate();
  const online = agent ? agentOnline(agent) : true;
  const total = services.length;
  const healthy = services.filter(s => s.healthy).length;
  const down = services.filter(s => !s.healthy);
  const allHealthy = down.length === 0;

  return (
    <div
      {...activatable(() => navigate(`/projects/${agentId}`))}
      aria-label={agentName}
      className="bg-bg-surface border border-ui-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:translate-y-0 flex flex-col gap-3"
    >
      {/* Header: status + project name + controls */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${online ? 'bg-status-healthy' : 'bg-status-idle'}`} />
          <div className="min-w-0">
            <h3 className="text-base font-bold text-text-base truncate leading-tight">{agentName}</h3>
            {agent?.version && (
              <span className="text-xs text-text-dim">v{agent.version}</span>
            )}
          </div>
        </div>
        {agent && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onViewKey(agent); }}
              aria-label={t('API 키 보기')} title={t('API 키 보기')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <MaterialIcon name="key" className="text-base" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent.id); }}
              aria-label={t('프로젝트 비활성화')}
              title={t('프로젝트 비활성화')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <MaterialIcon name="delete_outline" className="text-base" />
            </button>
          </div>
        )}
      </div>

      {/* Summary: service count + health */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-text-muted">{t('서비스 {count}개', { count: total })}</span>
        <span className={`flex items-center gap-1 text-sm font-semibold ${allHealthy ? 'text-status-healthy' : 'text-status-error'}`}>
          <MaterialIcon name={allHealthy ? 'check_circle' : 'cancel'} className="text-sm" />
          {healthy}/{total} {t('정상')}
        </span>
      </div>

      {/* Failing services preview */}
      {down.length > 0 && (
        <p className="text-xs text-status-error truncate -mt-1">
          {t('장애')}: {down.map(s => s.name).join(', ')}
        </p>
      )}

      {/* KPI rollup (from /agents/overview; hidden until it loads) */}
      {overview && (
        <div className="flex items-center gap-4 text-sm">
          <div>
            <div className="text-2xs text-text-dim">{t('가동률 30일')}</div>
            <div className="font-mono font-semibold text-text-base">
              {overview.uptimePct != null ? `${overview.uptimePct.toFixed(2)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-2xs text-text-dim">{t('요청 24h')}</div>
            <div className="font-mono font-semibold text-text-base">
              {overview.requests24h > 0
                ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(overview.requests24h)
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-2xs text-text-dim">p95</div>
            <div className={`font-mono font-semibold ${
              overview.p95Ms != null && overview.p95Ms > 500
                ? 'text-status-warn'
                : 'text-text-base'
            }`}>
              {overview.p95Ms != null ? `${overview.p95Ms}ms` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-ui-border-soft" />

      {/* Footer: online state + drill-in hint */}
      <div className="flex items-center justify-between gap-2 text-xs text-text-dim">
        <span>{online ? t('온라인') : t('오프라인')}</span>
        <span className="flex items-center gap-0.5">
          {t('서비스 보기')}
          <MaterialIcon name="chevron_right" className="text-sm" />
        </span>
      </div>
    </div>
  );
}

export function ServiceGridPage() {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [overview, setOverview] = useState<Record<string, AgentOverview>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [installModalAgent, setInstallModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [instrumentationAgentId, setInstrumentationAgentId] = useState<string | null>(null);
  const [keyModalAgent, setKeyModalAgent] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    // KPI rollup is non-critical — cards render without it and fill in when it lands.
    api.getAgentsOverview()
      .then((rows) => setOverview(Object.fromEntries((rows ?? []).map((o) => [o.agentId, o]))))
      .catch(() => {});
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

  const handleDelete = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    setDeleteTarget({ id: agentId, name: agent?.name ?? agentId });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteAgent(deleteTarget.id);
      toast.success(t('프로젝트가 비활성화됐습니다'));
      load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleteTarget(null);
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

  // Project search: a project matches if its name or any of its services match.
  const groups = allGroups.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.agentName.toLowerCase().includes(q) ||
      g.services.some((s) => s.name.toLowerCase().includes(q) || s.endpoint.toLowerCase().includes(q))
    );
  });

  const visiblePending = pendingAgents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-base">{t('프로젝트')}</h1>
          <p className="text-sm text-text-muted">
            {t('연결된 프로젝트와 모니터링 서비스 현황')}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <MaterialIcon name="add" className="text-base" />
          {t('프로젝트 추가')}
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('서비스 또는 프로젝트 이름으로 검색')}
      />

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-ui-hover animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 && agents.length === 0 ? (
        <EmptyState
          icon="sensors"
          title={t('아직 프로젝트가 없습니다')}
          description={t('프로젝트를 추가하고 API 키로 에이전트를 연결하세요')}
          action={{ label: t('프로젝트 추가'), onClick: () => setShowAddModal(true) }}
        />
      ) : groups.length === 0 && visiblePending.length === 0 ? (
        <div className="py-16 text-center text-text-dim text-sm">
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
              overview={overview[g.agentId]}
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
              onInstall={() => setInstallModalAgent({ id: agent.id, name: agent.name })}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServiceModal
          onClose={() => setShowAddModal(false)}
          onCreated={load}
          onOpenProject={(id) => {
            setShowAddModal(false);
            navigate(`/projects/${id}`);
          }}
          onConfigureInstrumentation={(id) => {
            setShowAddModal(false);
            setInstrumentationAgentId(id);
          }}
        />
      )}

      {installModalAgent && (
        <AddServiceModal
          existingAgent={installModalAgent}
          onClose={() => setInstallModalAgent(null)}
          onCreated={load}
          onOpenProject={(id) => {
            setInstallModalAgent(null);
            navigate(`/projects/${id}`);
          }}
          onConfigureInstrumentation={(id) => {
            setInstallModalAgent(null);
            setInstrumentationAgentId(id);
          }}
        />
      )}

      {instrumentationAgentId && (
        <InstrumentationOverrideModal
          agentId={instrumentationAgentId}
          onClose={() => setInstrumentationAgentId(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('프로젝트 비활성화')}
        message={t("{name} 프로젝트를 비활성화하시겠습니까?", { name: deleteTarget?.name ?? '' })}
        description={t('에이전트 연결이 차단되며 수집 데이터는 보존됩니다.')}
        confirmLabel={t('비활성화')}
      />

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
