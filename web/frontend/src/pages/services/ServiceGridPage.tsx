import { useState, useEffect, useCallback } from 'react';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../components/common';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { AgentServiceCard } from '../../features/services/components/AgentServiceCard';
import { PendingServiceCard } from '../../features/services/components/PendingServiceCard';
import { AddServiceModal } from '../../features/services/components/AddServiceModal';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';
import { toast } from 'react-hot-toast';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

interface AgentBannerProps {
  agents: ConnectedAgent[];
  onDelete: (id: string) => void;
  onViewKey: (agent: ConnectedAgent) => void;
}

function AgentBanner({ agents, onDelete, onViewKey }: AgentBannerProps) {
  const [expanded, setExpanded] = useState(false);
  if (agents.length === 0) return null;
  const onlineCount = agents.filter(agentOnline).length;
  const allOnline = onlineCount === agents.length;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium w-fit transition-colors ${
          allOnline
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${allOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        프로젝트 {onlineCount}/{agents.length} 온라인
        <MaterialIcon name={expanded ? 'expand_less' : 'expand_more'} className="text-sm" />
      </button>

      {expanded && (
        <div className="border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-ui-border-dark">
          {agents.map(agent => (
            <div key={agent.id} className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-bg-surface-dark">
              <div className="flex items-center gap-2.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${agentOnline(agent) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className="text-sm font-medium text-slate-800 dark:text-white">{agent.name}</span>
                {agent.version && (
                  <span className="text-xs text-slate-400 dark:text-text-dim-dark">v{agent.version}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onViewKey(agent)}
                  title="API 키 보기"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <MaterialIcon name="key" className="text-base" />
                </button>
                <button
                  onClick={() => onDelete(agent.id)}
                  title="프로젝트 비활성화"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <MaterialIcon name="delete_outline" className="text-base" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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

  const filtered = services.filter((s) => {
    if (filter === 'healthy' && !s.healthy) return false;
    if (filter === 'unhealthy' && s.healthy) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.agentName.toLowerCase().includes(q) ||
      s.endpoint.toLowerCase().includes(q)
    );
  });

  // Pending cards have no health, so only show them under the "all" filter.
  const visiblePending = filter === 'all'
    ? pendingAgents.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const healthyCount = services.filter((s) => s.healthy).length;
  const unhealthyCount = services.filter((s) => !s.healthy).length;

  const kpis = [
    { label: t('전체'), value: services.length, color: 'text-slate-900 dark:text-white', filterVal: 'all' as const },
    { label: t('정상'), value: healthyCount, color: 'text-emerald-600 dark:text-emerald-400', filterVal: 'healthy' as const },
    { label: t('장애'), value: unhealthyCount, color: unhealthyCount > 0 ? 'text-red-500' : 'text-slate-400 dark:text-text-dim-dark', filterVal: 'unhealthy' as const },
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
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <AgentBanner
            agents={connectedAgents}
            onDelete={handleDelete}
            onViewKey={(a) => setKeyModalAgent({ id: a.id, name: a.name })}
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            <MaterialIcon name="add" className="text-base" />
            프로젝트 추가
          </button>
        </div>
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
      ) : filtered.length === 0 && visiblePending.length === 0 ? (
        <div className="py-16 text-center text-slate-400 dark:text-text-muted-dark text-sm">
          {t('검색 결과가 없습니다')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePending.map((agent) => (
            <PendingServiceCard
              key={agent.id}
              agent={agent}
              onDelete={handleDelete}
              onViewKey={() => setKeyModalAgent({ id: agent.id, name: agent.name })}
            />
          ))}
          {filtered.map((svc) => (
            <AgentServiceCard key={`${svc.agentId}/${svc.key}`} service={svc} />
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
