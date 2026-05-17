import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { api, type LogEntry, type LogLevel } from '../../../services/api';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { TracePanel } from '../../traces/components/TracePanel';

interface ErrorLogTableProps {
  serviceId?: string;
  refreshKey?: number;
  traceFilter?: string | null;
  onClearTraceFilter?: () => void;
}

function methodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'POST':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'PUT':
    case 'PATCH':  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'DELETE': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:       return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
}

function statusBadgeClass(statusCode: number): string {
  if (statusCode >= 500) return 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (statusCode >= 400) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (statusCode >= 300) return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
  if (statusCode >= 200) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
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

const levelActiveStyle: Record<LevelFilter, string> = {
  all:   'bg-slate-100 dark:bg-ui-hover-dark text-slate-800 dark:text-white border-slate-300 dark:border-slate-500',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800',
  warn:  'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700',
  info:  'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700',
  debug: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700',
  trace: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600',
};

const levelInactiveStyle = 'border-slate-200 dark:border-ui-border-dark text-slate-400 dark:text-text-dim-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark';

const levelToneStyle: Record<LogLevel, string> = {
  error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  warn: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  info: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
  debug: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  trace: 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark',
};

function shortTraceId(traceId: string): string {
  return traceId.length <= 16 ? traceId : `${traceId.slice(0, 16)}...`;
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
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            24h Distribution
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-text-muted-dark">
            error {errorBuckets.reduce((a, b) => a + b, 0)} · warn {warnBuckets.reduce((a, b) => a + b, 0)}
          </p>
        </div>
        <div className="text-right text-xs text-slate-400 dark:text-text-dim-dark">
          <div>total {total}</div>
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

export function ErrorLogTable({ serviceId, refreshKey, traceFilter, onClearTraceFilter }: ErrorLogTableProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [limit, setLimit] = useState(LIMIT_STEP);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (isPaused) return;

    const fetchLogs = async () => {
      try {
        const params = {
          limit: String(limit),
          ...(levelFilter !== 'all' && { level: levelFilter }),
          ...(traceFilter ? { traceId: traceFilter } : {}),
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
  }, [serviceId, refreshKey, isPaused, levelFilter, limit, traceFilter, t]);

  const debouncedSearch = useDebouncedValue(searchQuery);
  const sourceLogs = logs;

  const filteredLogs = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return sourceLogs.filter((log) => {
      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      const matchesSearch =
        !q ||
        log.message.toLowerCase().includes(q) ||
        (log.fingerprint ?? '').toLowerCase().includes(q) ||
        (log.traceId ?? '').toLowerCase().includes(q) ||
        (log.spanId ?? '').toLowerCase().includes(q) ||
        (log.metadata ? JSON.stringify(log.metadata).toLowerCase().includes(q) : false);
      return matchesLevel && matchesSearch;
    });
  }, [sourceLogs, levelFilter, debouncedSearch]);

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
      {traceFilter && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          <MaterialIcon name="timeline" className="text-sm" />
          <span>{t('logs.traceFilter.label')}</span>
          <code className="font-mono truncate" title={traceFilter}>{shortTraceId(traceFilter)}</code>
          {onClearTraceFilter && (
            <button onClick={onClearTraceFilter} className="ml-auto rounded px-2 py-1 font-bold hover:bg-primary/20">
              {t('logs.traceFilter.clear')}
            </button>
          )}
        </div>
      )}

      <HistogramBand logs={filteredLogs.filter((log) => log.level === 'error' || log.level === 'warn')} />

      <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden">
        {/* Single filter row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-ui-border-dark px-4 py-2.5">
          {/* Level badge filters */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {LEVEL_FILTERS.map((level) => {
              const isActive = levelFilter === level;
              return (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors whitespace-nowrap ${
                    isActive ? levelActiveStyle[level] : levelInactiveStyle
                  }`}
                >
                  {level !== 'all' && (
                    <span className={`h-1.5 w-1.5 rounded-full ${levelDotStyle[level]} ${isActive ? '' : 'opacity-30'}`} />
                  )}
                  {t(`logs.filter.${level}`)}
                  <span className={`tabular-nums ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                    {levelCounts[level]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <MaterialIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('logs.searchPlaceholder')}
                className="h-8 w-44 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark pl-8 pr-3 text-xs text-slate-900 dark:text-white outline-none focus:border-primary focus:w-56 transition-all"
              />
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                isPaused
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
              }`}
            >
              <MaterialIcon name={isPaused ? 'play_arrow' : 'pause'} className="text-sm" />
              {isPaused ? t('common.resume') : t('common.pause')}
            </button>
          </div>
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

        {filteredLogs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30">
                    <td className="w-28 px-4 py-3 text-xs text-slate-500 dark:text-text-muted-dark whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="w-24 px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${levelToneStyle[log.level]}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="max-w-0 w-full px-4 py-3 text-sm text-slate-700 dark:text-text-base-dark">
                      <span className="block truncate" title={log.message}>{log.message}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(log.linkedRequest || log.traceId) && (
                        <div className="flex items-center justify-end gap-1.5">
                          {log.linkedRequest && (
                            <span
                              className="inline-flex max-w-65 items-center gap-1 rounded-md border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark/40 px-2 py-0.5 text-[11px]"
                              title={`${log.linkedRequest.method} ${log.linkedRequest.path}`}
                            >
                              <span className={`rounded px-1 py-px text-[10px] font-bold ${methodBadgeClass(log.linkedRequest.method)}`}>
                                {log.linkedRequest.method.toUpperCase()}
                              </span>
                              <span className="font-mono truncate text-slate-700 dark:text-text-base-dark">{log.linkedRequest.path}</span>
                              <span className={`rounded px-1 py-px text-[10px] font-bold ${statusBadgeClass(log.linkedRequest.statusCode)}`}>
                                {log.linkedRequest.statusCode}
                              </span>
                            </span>
                          )}
                          {log.traceId && (
                            <button
                              type="button"
                              onClick={() => setActiveTraceId(log.traceId ?? null)}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                              title={log.traceId}
                            >
                              <MaterialIcon name="timeline" className="text-sm" />
                              <span>{t('logs.traceFilter.viewTrace')}</span>
                            </button>
                          )}
                        </div>
                      )}
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

        {filteredLogs.length > 0 && logs.length >= limit && (
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
      {activeTraceId && (
        <TracePanel traceId={activeTraceId} onClose={() => setActiveTraceId(null)} />
      )}
    </div>
  );
}
