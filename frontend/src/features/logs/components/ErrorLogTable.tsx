import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { api, LogEntry } from '../../../services/api';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

interface ErrorLogTableProps {
  serviceId?: string;
  refreshKey?: number;
}

const LIMIT_STEP = 50;

const LEVEL_FILTERS = ['all', 'error', 'warn', 'info'] as const;
type LevelFilter = (typeof LEVEL_FILTERS)[number];

const levelBadgeStyle: Record<string, string> = {
  error:
    'bg-red-500/10 border-red-500/30 text-red-500 dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-400',
  warn:
    'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-400',
};

const levelDotStyle: Record<string, string> = {
  error: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-blue-500',
};

export function ErrorLogTable({ serviceId, refreshKey }: ErrorLogTableProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
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

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch = log.message.toLowerCase().includes(debouncedSearch.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const levelCounts: Record<LevelFilter, number> = {
    all: logs.length,
    error: logs.filter((l) => l.level === 'error').length,
    warn: logs.filter((l) => l.level === 'warn').length,
    info: logs.filter((l) => l.level === 'info').length,
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleCopyLog = (log: LogEntry) => {
    const logText = `[${log.createdAt}] [${log.level}] ${log.message}`;
    copy(logText);
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setLimit((prev) => prev + LIMIT_STEP);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
        <div className="h-6 bg-slate-200 dark:bg-ui-active-dark rounded w-32 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-ui-hover-dark rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">
          {t('logs.titleRecent')}
        </h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Pause/Resume Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              isPaused
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-ui-border-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark'
            }`}
          >
            <MaterialIcon name={isPaused ? 'play_arrow' : 'pause'} className="text-lg" />
            {isPaused ? t('common.resume') : t('common.pause')}
          </button>

          {/* Search */}
          <div className="relative flex-1 min-w-40">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-text-dim-dark text-lg"
            />
            <input
              type="text"
              placeholder={t('logs.searchPlaceholder')}
              aria-label={t('logs.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-100 dark:bg-ui-hover-dark border-none rounded-lg pl-10 pr-4 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-text-dim-dark w-full sm:w-64 focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Level Filter Chips */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {LEVEL_FILTERS.map((level) => {
          const isActive = levelFilter === level;
          return (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`cursor-pointer flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                isActive
                  ? level === 'all'
                    ? 'bg-slate-800 dark:bg-ui-active-dark text-white border-slate-700 dark:border-ui-border-dark'
                    : level === 'error'
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40'
                    : level === 'warn'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40'
                  : 'bg-transparent text-slate-500 dark:text-text-muted-dark border-slate-200 dark:border-ui-border-dark hover:border-slate-300 dark:hover:border-ui-active-dark'
              }`}
            >
              {level !== 'all' && (
                <span className={`w-1.5 h-1.5 rounded-full ${levelDotStyle[level]}`} />
              )}
              {t(`logs.filter.${level}`)}
              <span className="ml-0.5 opacity-70">{levelCounts[level]}</span>
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
          <MaterialIcon name="error_outline" className="text-lg shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Paused Banner */}
      {isPaused && (
        <div className="mb-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <MaterialIcon name="info" className="text-lg" />
            <span className="text-sm font-medium">{t('logs.pausedMessage')}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 dark:text-text-dim-dark text-xs font-bold uppercase tracking-widest border-b border-slate-200 dark:border-ui-border-dark">
              <th className="pb-3 px-2 w-8"></th>
              <th className="pb-3 px-2">{t('logs.table.timestamp')}</th>
              <th className="pb-3 px-2">{t('logs.table.level')}</th>
              <th className="pb-3 px-2">{t('logs.table.message')}</th>
              <th className="pb-3 px-2 text-right">{t('logs.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="text-sm font-mono divide-y divide-slate-200 dark:divide-ui-border-dark">
            {filteredLogs.map((log) => {
              const isExpanded = expandedRows.has(log.id);

              return (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30 transition-colors"
                >
                  <td className="py-4 px-2">
                    <button
                      onClick={() => toggleRow(log.id)}
                      aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
                      className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-text-secondary-dark transition-colors"
                    >
                      <MaterialIcon
                        name={isExpanded ? 'expand_less' : 'expand_more'}
                        className="text-lg"
                      />
                    </button>
                  </td>

                  <td className="py-4 px-2 text-slate-500 dark:text-text-muted-dark whitespace-nowrap tabular-nums">
                    {formatTimestamp(log.createdAt)}
                  </td>
                  <td className="py-4 px-2">
                    <span
                      className={`font-bold px-2 py-0.5 rounded border text-xs uppercase ${
                        levelBadgeStyle[log.level] || levelBadgeStyle.info
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-slate-900 dark:text-white max-w-sm">
                    {isExpanded ? (
                      <span className="break-all whitespace-pre-wrap">{log.message}</span>
                    ) : (
                      <span className="line-clamp-2">{log.message}</span>
                    )}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <button
                      onClick={() => handleCopyLog(log)}
                      aria-label={t('common.copyToClipboard')}
                      className="cursor-pointer text-slate-400 hover:text-primary transition-colors"
                    >
                      <MaterialIcon name="content_copy" className="text-base" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredLogs.length === 0 && !error && (
        <div className="py-12 text-center text-slate-500 dark:text-text-muted-dark">
          <MaterialIcon name="search_off" className="text-4xl mb-2" />
          <p>{logs.length === 0 ? t('logs.noLogs') : t('logs.noResults')}</p>
        </div>
      )}

      {/* Load More */}
      {filteredLogs.length > 0 && logs.length >= limit && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore || isPaused}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-sm font-medium text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <MaterialIcon name="sync" className="text-sm animate-spin" />
            ) : (
              <MaterialIcon name="expand_more" className="text-sm" />
            )}
            {t('logs.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
