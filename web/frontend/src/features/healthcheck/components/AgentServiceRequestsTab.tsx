import { useState, useEffect, useCallback } from 'react';
import { MaterialIcon } from '../../../components/common';
import { api, type ApiRequest } from '../../../services/api';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';
import { TracePanel } from '../../traces/components/TracePanel';
import { runtimeLabel } from '../runtimeLabels';

interface Props {
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  /** Agent-detected runtime — drives the setup hint in the empty state. */
  runtime?: string;
}

type DatePreset = '1d' | '7d' | '30d' | '';

function toISOFrom(preset: DatePreset): string | undefined {
  if (!preset) return undefined;
  const days = preset === '1d' ? 1 : preset === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000).toISOString();
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

export function AgentServiceRequestsTab({ agentId, serviceKey, refreshKey, runtime }: Props) {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAgentServiceRequests(agentId, serviceKey, {
        errorsOnly,
        search: search || undefined,
        from: toISOFrom(datePreset),
      });
      setRequests(res?.data ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agentId, serviceKey, refreshKey, errorsOnly, search, datePreset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputValue);
  };

  // KPI summary from current result set
  const errorCount = requests.filter(r => r.statusCode >= 400).length;
  const avgMs = requests.length > 0
    ? Math.round(requests.reduce((sum, r) => sum + r.durationMs, 0) / requests.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      {!loading && requests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '전체', value: `${total.toLocaleString()}건`, color: 'text-slate-700 dark:text-text-base-dark' },
            { label: '에러', value: `${errorCount}건`, color: errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-text-dim-dark' },
            { label: '평균', value: `${avgMs}ms`, color: 'text-slate-700 dark:text-text-base-dark' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark px-4 py-3 text-center">
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Error-only toggle */}
        <button
          onClick={() => setErrorsOnly(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            errorsOnly
              ? 'bg-red-500 text-white'
              : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-muted-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark'
          }`}
        >
          <MaterialIcon name="error_outline" className="text-sm" />
          에러만
        </button>

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

        {/* Path search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-48 flex gap-1.5">
          <div className="relative flex-1">
            <MaterialIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="경로 검색..."
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

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon name="http" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark">
            {search || errorsOnly || datePreset ? '조건에 맞는 요청이 없습니다' : '수집된 API 요청이 없습니다'}
          </p>
          {!search && !errorsOnly && !datePreset && (
            <div className="mt-6 mx-auto max-w-md text-left p-4 rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark">
              <p className="text-sm font-semibold text-slate-700 dark:text-text-base-dark mb-2">
                {runtime
                  ? `${runtimeLabel(runtime)} 서비스로 감지되었습니다. 트레이스를 수집하려면:`
                  : '트레이스를 수집하려면:'}
              </p>
              <ul className="space-y-1.5 text-sm text-slate-500 dark:text-text-muted-dark">
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold text-primary">1</span>
                  <span>
                    에이전트 compose의 <code className="font-mono text-xs bg-slate-100 dark:bg-ui-hover-dark px-1 py-0.5 rounded">everyup-ebpf</code> 블록
                    주석 해제 — 앱 수정 없이 경로·상태·지연시간 수집
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold text-primary">2</span>
                  <span>
                    헤더까지 필요하면 앱에 OpenTelemetry 연결
                    {runtime === 'java' && ' — Java는 JAVA_TOOL_OPTIONS 환경변수만으로 가능'}
                    {runtime === 'node' && ' — Node.js는 NODE_OPTIONS 환경변수만으로 가능'}
                    {runtime === 'python' && ' — Python은 opentelemetry-instrument로 가능'}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-ui-border-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
          {requests.map(req => {
            const clickable = !!req.traceId;
            return (
              <div
                key={req.id}
                onClick={() => req.traceId && setActiveTraceId(req.traceId)}
                className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-bg-surface-dark transition-colors ${clickable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-ui-hover-dark' : ''}`}
              >
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
                {clickable && (
                  <MaterialIcon name="timeline" className="shrink-0 text-base text-slate-300 dark:text-text-dim-dark" />
                )}
              </div>
            );
          })}
        </div>
      )}
      {activeTraceId && (
        <TracePanel traceId={activeTraceId} onClose={() => setActiveTraceId(null)} />
      )}
    </div>
  );
}
