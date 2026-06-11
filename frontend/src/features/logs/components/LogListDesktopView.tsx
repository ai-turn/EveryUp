import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader, EmptyState, FilterBar, KPIChip } from '../../../components/common';
import { LogServiceCard } from './LogServiceCard';
import type { LogEntry, LogLevel, Service } from '../../../services/api';

type ServiceViewMode = 'cards' | 'table';

const levelOrder: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '-';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function MiniBars({ logs }: { logs: LogEntry[] }) {
  const buckets = Array.from({ length: 12 }, () => 0);
  const now = Date.now();
  logs.forEach((log) => {
    const ageMinutes = Math.floor((now - new Date(log.createdAt).getTime()) / 60000);
    const index = 11 - Math.min(11, Math.max(0, Math.floor(ageMinutes / 10)));
    buckets[index] += log.level === 'error' ? 3 : log.level === 'warn' ? 2 : 1;
  });
  const max = Math.max(...buckets, 1);

  return (
    <div className="flex h-7 items-end gap-0.5">
      {buckets.map((value, index) => (
        <span
          key={index}
          className="w-1.5 rounded-t bg-primary/50 dark:bg-primary/60"
          style={{ height: `${Math.max(3, (value / max) * 26)}px` }}
        />
      ))}
    </div>
  );
}

interface LogListDesktopViewProps {
  services: Service[];
  filteredServices: Service[];
  latestLogs: Record<string, LogEntry | null>;
  serviceLogs: Record<string, LogEntry[]>;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddService: () => void;
  onServiceClick: (id: string) => void;
}

export function LogListDesktopView({
  services,
  filteredServices,
  latestLogs,
  serviceLogs,
  loading,
  error,
  searchQuery,
  onSearchChange,
  onAddService,
  onServiceClick,
}: LogListDesktopViewProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [viewMode, setViewMode] = useState<ServiceViewMode>('cards');
  const allRecentLogs = Object.values(serviceLogs).flat();
  const receivingCount = services.filter((s) => !!latestLogs[s.id]).length;
  const waitingCount = services.length - receivingCount;
  const errorCount = allRecentLogs.filter((log) => log.level === 'error').length;
  const warnCount = allRecentLogs.filter((log) => log.level === 'warn').length;
  const errorServiceCount = services.filter((s) => (serviceLogs[s.id] ?? []).some((l) => l.level === 'error')).length;
  const warnServiceCount = services.filter((s) => (serviceLogs[s.id] ?? []).some((l) => l.level === 'warn')).length;

  return (
    <>
      <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')}>
        <button
          onClick={onAddService}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-bold transition-all text-primary cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('logServices.add.submit')}
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <KPIChip label={t('logs.kpi.services')} value={services.length} tone="primary" icon="article" />
        <KPIChip label={t('logs.kpi.receiving')} value={receivingCount} tone="emerald" icon="cloud_done" />
        <KPIChip label={t('logs.kpi.waiting')} value={waitingCount} tone={waitingCount > 0 ? 'amber' : 'slate'} icon="schedule" />
        <KPIChip label={t('logs.kpi.errors')} value={errorCount} tone={errorCount > 0 ? 'red' : 'slate'} icon="error" />
        <KPIChip label={t('logs.kpi.warnings')} value={warnCount} tone={warnCount > 0 ? 'amber' : 'slate'} icon="warning" />
      </div>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('logs.searchPlaceholder')}
      />

      {services.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold">
              {t('logs.filter.all')} {services.length}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold">
              {t('logs.filter.error')} {errorServiceCount}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold">
              {t('logs.filter.warn')} {warnServiceCount}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark text-slate-500 dark:text-text-muted-dark text-xs font-bold">
              {t('logs.tabs.waiting')} {waitingCount}
            </span>
          </div>

          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-ui-border-dark bg-slate-100 dark:bg-bg-surface-dark/50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-ui-hover-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-base-dark'
              }`}
            >
              <MaterialIcon name="grid_view" className="text-sm" />
              {t('logs.view.cards', { defaultValue: '카드' })}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-ui-hover-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-base-dark'
              }`}
            >
              <MaterialIcon name="view_list" className="text-sm" />
              {t('logs.view.table', { defaultValue: '테이블' })}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <MaterialIcon name="error_outline" className="text-xl shrink-0" />
          <p className="text-sm font-medium">{t('common.error')}: {error}</p>
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <EmptyState
          icon="article"
          title={t('logServices.empty')}
          description={t('logServices.emptyDesc')}
          action={{ label: t('logServices.add.submit'), onClick: onAddService }}
        />
      )}

      {!loading && !error && filteredServices.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <LogServiceCard
              key={service.id}
              service={service}
              recentLogs={serviceLogs[service.id] ?? []}
              onClick={() => onServiceClick(service.id)}
            />
          ))}
        </div>
      )}

      {!loading && !error && filteredServices.length > 0 && viewMode === 'table' && (
        <LogServiceTable
          services={filteredServices}
          serviceLogs={serviceLogs}
          onServiceClick={onServiceClick}
        />
      )}

      {!loading && !error && services.length > 0 && filteredServices.length === 0 && (
        <div className="py-20 text-center border border-dashed border-slate-200 dark:border-ui-border-dark rounded-2xl bg-slate-50/50 dark:bg-bg-surface-dark/50">
          <MaterialIcon name="search_off" className="text-5xl text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-text-muted-dark font-medium">{t('logs.noResults')}</p>
        </div>
      )}
    </>
  );
}

function LogServiceTable({
  services,
  serviceLogs,
  onServiceClick,
}: {
  services: Service[];
  serviceLogs: Record<string, LogEntry[]>;
  onServiceClick: (id: string) => void;
}) {
  const { t } = useTranslation(['logs', 'common']);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
      <div className="grid grid-cols-[minmax(220px,1.3fr)_112px_120px_minmax(220px,1.4fr)_150px_92px] gap-3 px-4 py-2.5 bg-slate-50/80 dark:bg-ui-hover-dark/40 border-b border-slate-100 dark:border-ui-border-dark text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">
        <div>{t('logs.table.service', { defaultValue: '서비스' })}</div>
        <div>{t('logs.table.timestamp', { defaultValue: '시간' })}</div>
        <div>{t('logs.table.level', { defaultValue: '레벨' })}</div>
        <div>{t('logs.table.message', { defaultValue: '메시지' })}</div>
        <div>{t('logs.view.activity', { defaultValue: '활동' })}</div>
        <div className="text-right">{t('logs.table.actions', { defaultValue: '작업' })}</div>
      </div>

      {services.map((service) => {
        const logs = serviceLogs[service.id] ?? [];
        const latest = logs[0];
        const counts = levelOrder.reduce<Record<LogLevel, number>>((acc, level) => {
          acc[level] = logs.filter((log) => log.level === level).length;
          return acc;
        }, { error: 0, warn: 0, info: 0, debug: 0, trace: 0 });

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onServiceClick(service.id)}
            className="grid w-full grid-cols-[minmax(220px,1.3fr)_112px_120px_minmax(220px,1.4fr)_150px_92px] gap-3 px-4 py-3 text-left border-b last:border-b-0 border-slate-100 dark:border-ui-border-dark/60 hover:bg-slate-50/70 dark:hover:bg-ui-hover-dark/30 transition-colors"
          >
            <div className="min-w-0">
              <div className="font-mono text-sm font-bold text-slate-900 dark:text-white truncate">{service.name}</div>
              <div className="text-xs text-slate-400 dark:text-text-dim-dark truncate">{service.id}</div>
            </div>
            <div className="flex flex-col justify-center text-sm text-slate-500 dark:text-text-muted-dark">
              <span className="font-semibold tabular-nums text-slate-700 dark:text-text-base-dark">{formatTimeAgo(latest?.createdAt)}</span>
              <span className="text-xs">{logs.length} recent</span>
            </div>
            <div className="flex items-center gap-1.5">
              {levelOrder.slice(0, 3).map((level) => (
                <span
                  key={level}
                  className={`rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                    level === 'error' && counts[level] > 0
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : level === 'warn' && counts[level] > 0
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark'
                  }`}
                  title={level}
                >
                  {level[0].toUpperCase()} {counts[level]}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex items-center gap-2 font-mono text-xs">
              {latest ? (
                <>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      latest.level === 'error'
                        ? 'bg-red-500'
                        : latest.level === 'warn'
                        ? 'bg-amber-400'
                        : latest.level === 'info'
                        ? 'bg-sky-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span className={`${latest.level === 'error' ? 'text-red-500' : latest.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-text-base-dark'} truncate`}>
                    {latest.message}
                  </span>
                </>
              ) : (
                <span className="text-slate-400 dark:text-text-dim-dark">{t('logs.card.noRecent', { defaultValue: '최근 수신된 로그가 없습니다' })}</span>
              )}
            </div>
            <div className="flex items-center text-primary">
              <MiniBars logs={logs} />
            </div>
            <div className="flex items-center justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                {t('logServices.viewLogs', { defaultValue: '로그 보기' })}
                <MaterialIcon name="arrow_forward" className="text-sm" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
