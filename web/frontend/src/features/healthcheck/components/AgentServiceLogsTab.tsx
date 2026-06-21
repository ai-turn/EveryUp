import { useState, useEffect } from 'react';
import { MaterialIcon } from '../../../components/common';
import { api, type LogEntry, type LogLevel } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';

interface Props {
  agentId: string;
  serviceKey: string;
  refreshKey: number;
}

const levelStyle: Record<LogLevel, string> = {
  error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  warn:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  info:  'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
  debug: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  trace: 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark',
};

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function AgentServiceLogsTab({ agentId, serviceKey, refreshKey }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getAgentServiceLogs(agentId, serviceKey)
      .then(res => {
        setLogs(res.data ?? []);
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

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center">
        <MaterialIcon name="article" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
        <p className="text-sm text-slate-400 dark:text-text-muted-dark">수집된 로그가 없습니다</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-text-muted-dark mb-3">
        최근 {logs.length}건 / 전체 {total.toLocaleString()}건
      </p>
      <div className="divide-y divide-slate-100 dark:divide-ui-border-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-bg-surface-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors">
            <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-xs font-bold uppercase ${levelStyle[log.level] ?? levelStyle.info}`}>
              {log.level}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800 dark:text-text-base-dark break-words">{log.message}</p>
              <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-0.5">{formatTime(log.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
