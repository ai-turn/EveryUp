import { useEffect, useState } from 'react';
import { api, type ConnectedAgent, type AgentServiceSnapshot } from '../../../services/api';

type AgentSummary = {
  agent: ConnectedAgent;
  services: AgentServiceSnapshot[];
};

function agentState(agent: ConnectedAgent) {
  const lastSeen = new Date(agent.lastSeenAt).getTime();
  if (!Number.isFinite(lastSeen)) return 'unknown';
  const ageMs = Date.now() - lastSeen;
  if (ageMs < 2 * 60 * 1000) return 'online';
  if (ageMs < 10 * 60 * 1000) return 'stale';
  return 'offline';
}

const stateClass: Record<string, string> = {
  online: 'bg-emerald-500',
  stale: 'bg-amber-500',
  offline: 'bg-red-500',
  unknown: 'bg-slate-400',
};

export function ConnectedAgentsStatus() {
  const [items, setItems] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const agents = await api.getAgents();
        const summaries = await Promise.all(
          agents.slice(0, 4).map(async (agent) => ({
            agent,
            services: await api.getAgentServices(agent.id),
          })),
        );
        if (alive) setItems(summaries);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Connected Agents</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-text-muted-dark">Standalone agents reporting into EveryUp Web</p>
        </div>
        {!loading && items.length > 0 && (
          <span className="text-sm font-medium text-slate-500 dark:text-text-muted-dark">{items.length} agents</span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map((item) => (
            <div key={item} className="h-24 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-ui-border-dark px-4 py-5 text-sm text-slate-500 dark:text-text-muted-dark">
          No connected agents yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(({ agent, services }) => {
            const state = agentState(agent);
            const unhealthy = services.filter((service) => service.seen && !service.healthy).length;
            return (
              <div key={agent.id} className="rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-ui-card-dark p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${stateClass[state]}`} />
                      <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{agent.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-text-muted-dark">
                      {agent.mode}{agent.version ? ` · ${agent.version}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium capitalize text-slate-500 dark:text-text-muted-dark">{state}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-text-dim-dark">Services</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{services.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-text-dim-dark">Unhealthy</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{unhealthy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-text-dim-dark">Last Seen</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{new Date(agent.lastSeenAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
