import { useState, useEffect, useCallback } from 'react';
import { MaterialIcon } from '../../../components/common';
import { api, type LogEntry, type LogLevel } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';

interface Props {
  agentId: string;
  serviceKey: string;
  refreshKey: number;
}

const LOG_LEVELS: { value: LogLevel | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
  { value: 'trace', label: 'TRACE' },
];

const LEVEL_STYLE: Record<string, string> = {
  error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  warn:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  info:  'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
  debug: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  trace: 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark',
};

type DatePreset = '1d' | '7d' | '30d' | '';

function toISOFrom(preset: DatePreset): string | undefined {
  if (!preset) return undefined;
  const days = preset === '1d' ? 1 : preset === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div
      className={`px-4 py-3 bg-white dark:bg-bg-surface-dark transition-colors ${hasMeta ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-ui-hover-dark' : ''}`}
      onClick={() => hasMeta && setExpanded(v => !v)}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-xs font-bold uppercase ${LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info}`}>
          {log.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800 dark:text-text-base-dark wrap-break-word">{log.message}</p>
          <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-0.5">{formatTime(log.createdAt)}</p>
        </div>
        {hasMeta && (
          <MaterialIcon
            name={expanded ? 'expand_less' : 'expand_more'}
            className="text-base text-slate-400 dark:text-text-dim-dark shrink-0 mt-0.5"
          />
        )}
      </div>
      {expanded && hasMeta && (
        <pre className="mt-3 ml-11 text-xs font-mono text-slate-600 dark:text-text-muted-dark bg-slate-50 dark:bg-ui-hover-dark rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AgentServiceLogsTab({ agentId, serviceKey, refreshKey }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAgentServiceLogs(agentId, serviceKey, {
        level: level || undefined,
        search: search || undefined,
        from: toISOFrom(datePreset),
      });
      setLogs(res?.data ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agentId, serviceKey, refreshKey, level, search, datePreset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level chips */}
        <div className="flex flex-wrap gap-1">
          {LOG_LEVELS.map(l => (
            <button
              key={l.value}
              onClick={() => setLevel(l.value as LogLevel | '')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                level === l.value
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-muted-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Date presets */}
        <div className="flex gap-1">
          {([['', '전체'], ['1d', '오늘'], ['7d', '7일'], ['30d', '30일']] as [DatePreset, string][]).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setDatePreset(val)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                datePreset === val
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-48 flex gap-1.5">
          <div className="relative flex-1">
            <MaterialIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="메시지 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-ui-hover-dark border border-transparent focus:border-primary dark:text-white placeholder-slate-400 dark:placeholder-text-dim-dark outline-none transition-colors"
            />
          </div>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setInputValue(''); }}
              className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-500 transition-colors">
              <MaterialIcon name="close" className="text-sm" />
            </button>
          )}
        </form>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-400 dark:text-text-dim-dark">
          {total.toLocaleString()}건 중 {logs.length}건 표시
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon name="article" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark">
            {search || level || datePreset ? '조건에 맞는 로그가 없습니다' : '수집된 로그가 없습니다'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-ui-border-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
          {logs.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}
    </div>
  );
}
