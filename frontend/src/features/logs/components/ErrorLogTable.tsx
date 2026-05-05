import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { api, type LogEntry, type LogLevel } from '../../../services/api';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface ErrorLogTableProps {
  serviceId?: string;
  refreshKey?: number;
}

const LIMIT_STEP = 50;
const LEVEL_FILTERS = ['all', 'error', 'warn', 'info', 'debug', 'trace'] as const;
type LevelFilter = (typeof LEVEL_FILTERS)[number];

const levelDotStyle: Record<LogLevel, string> = {
  error: 'bg-red-500',
  warn: 'bg-amber-400',
  info: 'bg-sky-400',
  debug: 'bg-violet-400',
  trace: 'bg-slate-400',
};

const levelToneStyle: Record<LogLevel, string> = {
  error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  warn: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  info: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
  debug: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  trace: 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark',
};

interface LogGroup {
  id: string;
  level: LogLevel;
  title: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sample: LogEntry;
  histogram: number[];
}

function buildExampleLogs(serviceId?: string): LogEntry[] {
  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const id = serviceId || 'example-log-service';

  return [
    {
      id: 9001,
      serviceId: id,
      serviceName: 'Example API',
      level: 'error',
      message: 'TypeError: Cannot read properties of undefined (reading "id") at processOrder',
      source: 'external',
      fingerprint: 'example-typeerror-order-id',
      metadata: {
        requestId: 'req_EXAMPLE_8X2',
        path: '/api/v2/orders',
        method: 'POST',
        release: 'v2.4.1',
      },
      createdAt: ago(2),
    },
    {
      id: 9002,
      serviceId: id,
      serviceName: 'Example API',
      level: 'error',
      message: 'TypeError: Cannot read properties of undefined (reading "id") at processOrder',
      source: 'external',
      fingerprint: 'example-typeerror-order-id',
      metadata: {
        requestId: 'req_EXAMPLE_8X7',
        path: '/api/v2/orders',
        method: 'POST',
        release: 'v2.4.1',
      },
      createdAt: ago(18),
    },
    {
      id: 9003,
      serviceId: id,
      serviceName: 'Example API',
      level: 'error',
      message: 'upstream timeout after 5000ms: billing-svc /charge',
      source: 'agent',
      fingerprint: 'example-billing-timeout',
      metadata: {
        requestId: 'req_EXAMPLE_KKP',
        upstream: 'billing-svc',
        timeoutMs: 5000,
      },
      createdAt: ago(41),
    },
    {
      id: 9004,
      serviceId: id,
      serviceName: 'Example API',
      level: 'warn',
      message: 'rate-limit: 92% of window used for client 10.0.4.12',
      source: 'internal',
      fingerprint: 'example-rate-limit-window',
      metadata: {
        ip: '10.0.4.12',
        used: 552,
        limit: 600,
        windowSec: 60,
      },
      createdAt: ago(7),
    },
    {
      id: 9005,
      serviceId: id,
      serviceName: 'Example API',
      level: 'warn',
      message: 'slow query: SELECT * FROM events WHERE created_at > $1 took 1284ms',
      source: 'internal',
      fingerprint: 'example-slow-query-events',
      metadata: {
        table: 'events',
        durationMs: 1284,
        thresholdMs: 1000,
      },
      createdAt: ago(63),
    },
    {
      id: 9006,
      serviceId: id,
      serviceName: 'Example API',
      level: 'info',
      message: 'worker pool scaled up to 8 concurrent processors',
      source: 'internal',
      createdAt: ago(96),
    },
  ];
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '-';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatClock(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function bucketIndex(dateStr: string): number {
  const ageHours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3_600_000);
  return 23 - Math.min(23, Math.max(0, ageHours));
}

function buildHistogram(logs: LogEntry[]): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);
  logs.forEach((log) => {
    buckets[bucketIndex(log.createdAt)] += 1;
  });
  return buckets;
}

function buildGroups(logs: LogEntry[]): LogGroup[] {
  const map = new Map<string, LogEntry[]>();
  logs.forEach((log) => {
    const key = log.fingerprint || `${log.level}:${log.message.slice(0, 160)}`;
    map.set(key, [...(map.get(key) ?? []), log]);
  });

  return Array.from(map.entries())
    .map(([id, groupLogs]) => {
      const sorted = [...groupLogs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const last = sorted[0];
      const first = sorted[sorted.length - 1];
      return {
        id,
        level: last.level,
        title: last.message,
        count: sorted.length,
        firstSeen: first.createdAt,
        lastSeen: last.createdAt,
        sample: last,
        histogram: buildHistogram(sorted),
      };
    })
    .sort((a, b) => {
      const levelWeight = (level: LogLevel) => (level === 'error' ? 2 : level === 'warn' ? 1 : 0);
      const byLevel = levelWeight(b.level) - levelWeight(a.level);
      if (byLevel !== 0) return byLevel;
      return b.count - a.count;
    });
}

function HistogramBand({ logs }: { logs: LogEntry[] }) {
  const errorBuckets = buildHistogram(logs.filter((log) => log.level === 'error'));
  const warnBuckets = buildHistogram(logs.filter((log) => log.level === 'warn'));
  const total = logs.length;
  const max = Math.max(...errorBuckets.map((e, i) => e + warnBuckets[i]), 1);
  const peakIndex = errorBuckets.reduce((peak, _, i) => {
    const value = errorBuckets[i] + warnBuckets[i];
    const peakValue = errorBuckets[peak] + warnBuckets[peak];
    return value > peakValue ? i : peak;
  }, 0);

  return (
    <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            24h Distribution
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-text-muted-dark">
            error {errorBuckets.reduce((a, b) => a + b, 0)} · warn {warnBuckets.reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-400 dark:text-text-dim-dark">
          <div className="font-mono">total {total}</div>
          <div>peak -{23 - peakIndex}h</div>
        </div>
      </div>
      <div className="flex h-24 items-end gap-1">
        {errorBuckets.map((errorCount, index) => {
          const warnCount = warnBuckets[index];
          const height = Math.max(3, ((errorCount + warnCount) / max) * 96);
          return (
            <div key={index} className="flex-1 flex items-end">
              <div
                className={`w-full rounded-t ${
                  errorCount > 0
                    ? 'bg-red-500'
                    : warnCount > 0
                    ? 'bg-amber-400'
                    : 'bg-slate-200 dark:bg-ui-hover-dark'
                }`}
                style={{ height }}
                title={`-${23 - index}h: error ${errorCount}, warn ${warnCount}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-4 text-[10px] text-slate-400 dark:text-text-dim-dark">
        <span>-24h</span>
        <span className="text-center">-12h</span>
        <span className="text-center">-6h</span>
        <span className="text-right">now</span>
      </div>
    </section>
  );
}

function GroupSpark({ data, level }: { data: number[]; level: LogLevel }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {data.map((value, index) => (
        <span
          key={index}
          className={`w-1 rounded-t ${value > 0 ? levelDotStyle[level] : 'bg-slate-200 dark:bg-ui-hover-dark'}`}
          style={{ height: `${Math.max(2, (value / max) * 32)}px` }}
        />
      ))}
    </div>
  );
}

function ErrorGroupRow({
  group,
  open,
  onToggle,
  onCopy,
}: {
  group: LogGroup;
  open: boolean;
  onToggle: () => void;
  onCopy: (log: LogEntry) => void;
}) {
  return (
    <div className={`border-b last:border-b-0 border-slate-100 dark:border-ui-border-dark/60 ${open ? 'bg-slate-50/60 dark:bg-ui-hover-dark/20' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[28px_minmax(280px,1fr)_96px_136px_112px] gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30 transition-colors"
      >
        <span className="flex items-center justify-center text-slate-400">
          <MaterialIcon name={open ? 'expand_more' : 'chevron_right'} className="text-lg" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[11px] font-black uppercase ${levelToneStyle[group.level]}`}>
              {group.level}
            </span>
            <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">
              {group.title}
            </span>
          </span>
          <span className="mt-1 block text-[11px] text-slate-400 dark:text-text-dim-dark">
            최초 {formatTimeAgo(group.firstSeen)} 전 · 소스 {group.sample.source ?? '-'}
          </span>
        </span>
        <span className="text-right">
          <span className={`block text-lg font-black tabular-nums ${group.level === 'error' ? 'text-red-500' : group.level === 'warn' ? 'text-amber-500' : 'text-slate-700 dark:text-text-base-dark'}`}>
            {group.count}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-text-dim-dark">건</span>
        </span>
        <span className="flex items-center">
          <GroupSpark data={group.histogram} level={group.level} />
        </span>
        <span className="text-right text-xs text-slate-500 dark:text-text-muted-dark">
          <span className="block font-semibold text-slate-700 dark:text-text-base-dark">{formatTimeAgo(group.lastSeen)} 전</span>
          <span>{formatClock(group.lastSeen)}</span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pl-14">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">원본 메시지</span>
                <button onClick={() => onCopy(group.sample)} className="text-xs font-bold text-primary hover:underline">
                  복사
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-slate-700 dark:text-text-base-dark">
                {group.sample.message}
              </pre>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-3">
              <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">컨텍스트</div>
              {group.sample.metadata && Object.keys(group.sample.metadata).length > 0 ? (
                <pre className="max-h-52 overflow-auto rounded bg-slate-50 dark:bg-ui-hover-dark p-3 font-mono text-xs text-slate-600 dark:text-text-muted-dark">
                  {JSON.stringify(group.sample.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-slate-400 dark:text-text-dim-dark">추가 정보 없음</p>
              )}
              {group.sample.fingerprint && (
                <p className="mt-2 font-mono text-[11px] text-slate-400 dark:text-text-dim-dark">
                  fingerprint: {group.sample.fingerprint}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorLogTable({ serviceId, refreshKey }: ErrorLogTableProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grouped' | 'raw'>('grouped');
  const [limit, setLimit] = useState(LIMIT_STEP);
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (isPaused) return;

    const fetchLogs = async () => {
      try {
        const params = {
          limit: String(limit),
          ...(levelFilter !== 'all' && { level: levelFilter }),
        };
        const data = serviceId
          ? await api.getServiceLogs(serviceId, params)
          : await api.getLogs(params);
        setLogs(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('logs.fetchError'));
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    };

    fetchLogs();
  }, [serviceId, refreshKey, isPaused, levelFilter, limit, t]);

  const debouncedSearch = useDebouncedValue(searchQuery);
  const exampleLogs = useMemo(() => buildExampleLogs(serviceId), [serviceId]);
  const isExampleMode = !error && logs.length === 0;
  const sourceLogs = isExampleMode ? exampleLogs : logs;

  const filteredLogs = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return sourceLogs.filter((log) => {
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      const matchesSearch =
        !q ||
        log.message.toLowerCase().includes(q) ||
        (log.fingerprint ?? '').toLowerCase().includes(q);
      return matchesLevel && matchesSearch;
    });
  }, [sourceLogs, levelFilter, debouncedSearch]);

  const groups = useMemo(() => buildGroups(filteredLogs), [filteredLogs]);

  const levelCounts: Record<LevelFilter, number> = {
    all: sourceLogs.length,
    error: sourceLogs.filter((l) => l.level === 'error').length,
    warn: sourceLogs.filter((l) => l.level === 'warn').length,
    info: sourceLogs.filter((l) => l.level === 'info').length,
    debug: sourceLogs.filter((l) => l.level === 'debug').length,
    trace: sourceLogs.filter((l) => l.level === 'trace').length,
  };

  const handleCopyLog = (log: LogEntry) => {
    copy(`[${log.createdAt}] [${log.level}] ${log.message}`);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-6">
        <div className="h-28 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HistogramBand logs={filteredLogs.filter((log) => log.level === 'error' || log.level === 'warn')} />

      <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden">
        {isExampleMode && (
          <div className="flex items-center gap-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <MaterialIcon name="science" className="text-sm" />
            실제 수집 로그가 없어 예시 데이터로 화면 구성을 보여줍니다.
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-ui-border-dark px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">{t('logs.titleRecent')}</h2>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark">
              {viewMode === 'grouped' ? `${groups.length}개 그룹` : `${filteredLogs.length}건`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                isPaused
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
              }`}
            >
              <MaterialIcon name={isPaused ? 'play_arrow' : 'pause'} className="text-sm" />
              {isPaused ? t('common.resume') : t('common.pause')}
            </button>
            <div className="relative min-w-56">
              <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('logs.searchPlaceholder')}
                className="h-9 w-full rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark pl-9 pr-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary"
              />
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-ui-border-dark bg-slate-100 dark:bg-ui-hover-dark p-1">
              <button
                onClick={() => setViewMode('grouped')}
                className={`rounded-md px-3 py-1 text-xs font-bold ${viewMode === 'grouped' ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-text-muted-dark'}`}
              >
                그룹
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`rounded-md px-3 py-1 text-xs font-bold ${viewMode === 'raw' ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-text-muted-dark'}`}
              >
                원본
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-ui-border-dark px-4 py-3">
          {LEVEL_FILTERS.map((level) => {
            const isActive = levelFilter === level;
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
                }`}
              >
                {level !== 'all' && <span className={`h-1.5 w-1.5 rounded-full ${levelDotStyle[level]}`} />}
                {t(`logs.filter.${level}`)}
                <span className="opacity-70">{levelCounts[level]}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <MaterialIcon name="error_outline" className="text-lg shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isPaused && (
          <div className="m-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {t('logs.pausedMessage')}
          </div>
        )}

        {viewMode === 'grouped' && groups.length > 0 && (
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              {groups.map((group) => (
                <ErrorGroupRow
                  key={group.id}
                  group={group}
                  open={openId === group.id}
                  onToggle={() => setOpenId(openId === group.id ? null : group.id)}
                  onCopy={handleCopyLog}
                />
              ))}
            </div>
          </div>
        )}

        {viewMode === 'raw' && filteredLogs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30">
                    <td className="w-28 px-4 py-3 font-mono text-xs text-slate-500 dark:text-text-muted-dark whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="w-24 px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-black uppercase ${levelToneStyle[log.level]}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-text-base-dark">
                      {log.message}
                    </td>
                    <td className="w-12 px-4 py-3 text-right">
                      <button onClick={() => handleCopyLog(log)} className="text-slate-400 hover:text-primary">
                        <MaterialIcon name="content_copy" className="text-base" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredLogs.length === 0 && !error && (
          <div className="py-14 text-center text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="search_off" className="text-4xl mb-2" />
            <p>{sourceLogs.length === 0 ? t('logs.noLogs') : t('logs.noResults')}</p>
          </div>
        )}

        {filteredLogs.length > 0 && !isExampleMode && logs.length >= limit && (
          <div className="flex justify-center border-t border-slate-100 dark:border-ui-border-dark px-4 py-4">
            <button
              onClick={() => {
                setIsLoadingMore(true);
                setLimit((prev) => prev + LIMIT_STEP);
              }}
              disabled={isLoadingMore || isPaused}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-ui-border-dark px-4 py-2 text-sm font-bold text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark disabled:opacity-50"
            >
              {isLoadingMore ? <MaterialIcon name="sync" className="text-sm animate-spin" /> : <MaterialIcon name="expand_more" className="text-sm" />}
              {t('logs.loadMore')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
