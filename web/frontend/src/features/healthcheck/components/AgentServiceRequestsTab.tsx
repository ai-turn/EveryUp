import { useState, useEffect } from 'react';
import { MaterialIcon } from '../../../components/common';
import { api, type ApiRequest } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';

interface Props {
  agentId: string;
  serviceKey: string;
  refreshKey: number;
}

function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'POST':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'PUT':
    case 'PATCH':  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'DELETE': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:       return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
}

function statusClass(code: number): string {
  if (code >= 500) return 'text-red-600 dark:text-red-400';
  if (code >= 400) return 'text-amber-600 dark:text-amber-400';
  if (code >= 200) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-slate-500 dark:text-text-muted-dark';
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function AgentServiceRequestsTab({ agentId, serviceKey, refreshKey }: Props) {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAgentServiceRequests(agentId, serviceKey)
      .then(res => {
        setRequests(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(err => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [agentId, serviceKey, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-16 text-center">
        <MaterialIcon name="http" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
        <p className="text-sm text-slate-400 dark:text-text-muted-dark">수집된 API 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-3">
        최근 {requests.length}건 / 전체 {total.toLocaleString()}건
      </p>
      <div className="divide-y divide-slate-100 dark:divide-ui-border-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
        {requests.map(req => (
          <div key={req.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-bg-surface-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors">
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-bold uppercase ${methodClass(req.method)}`}>
              {req.method}
            </span>
            <span className={`shrink-0 font-mono text-sm font-bold ${statusClass(req.statusCode)}`}>
              {req.statusCode}
            </span>
            <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-text-base-dark truncate font-mono">
              {req.path}
            </span>
            <span className="shrink-0 text-xs text-slate-400 dark:text-text-dim-dark">{req.durationMs}ms</span>
            <span className="shrink-0 text-xs text-slate-400 dark:text-text-dim-dark">{formatTime(req.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
