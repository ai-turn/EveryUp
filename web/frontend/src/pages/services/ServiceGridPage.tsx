import { useState, useEffect, useCallback } from 'react';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../components/common';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { AgentServiceCard } from '../../features/services/components/AgentServiceCard';

function agentOnline(agent: ConnectedAgent): boolean {
  const ageMs = Date.now() - new Date(agent.lastSeenAt).getTime();
  return ageMs < 2 * 60 * 1000;
}

function AgentBanner({ agents }: { agents: ConnectedAgent[] }) {
  if (agents.length === 0) return null;
  const onlineCount = agents.filter(agentOnline).length;
  const allOnline = onlineCount === agents.length;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium w-fit ${
      allOnline
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${allOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      에이전트 {onlineCount}/{agents.length} 온라인
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslate();
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center">
        <MaterialIcon name="sensors" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold text-slate-700 dark:text-white">
          {t('연결된 에이전트가 없습니다')}
        </p>
        <p className="text-sm text-slate-500 dark:text-text-muted-dark max-w-sm">
          {t('Agent를 배포하고 Docker 라벨을 추가하면 서비스가 자동으로 감지됩니다')}
        </p>
      </div>
      <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark text-left max-w-sm w-full">
        <p className="text-xs font-mono text-slate-500 dark:text-text-muted-dark leading-relaxed">
          everyup.enabled: <span className="text-emerald-600 dark:text-emerald-400">"true"</span>{'\n'}
          everyup.service.name: <span className="text-sky-600 dark:text-sky-400">"api"</span>
        </p>
      </div>
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
        <AgentBanner agents={agents} />
      </div>

      {/* KPI cards — clickable filter */}
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
          placeholder={t('서비스 또는 에이전트 이름으로 검색')}
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
      ) : filtered.length === 0 && services.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400 dark:text-text-muted-dark text-sm">
          {t('검색 결과가 없습니다')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((svc) => (
            <AgentServiceCard key={`${svc.agentId}/${svc.key}`} service={svc} />
          ))}
        </div>
      )}
    </div>
  );
}
