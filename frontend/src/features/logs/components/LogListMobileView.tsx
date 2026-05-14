import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { LogServiceCard } from './LogServiceCard';
import { LogStreamTab } from './LogStreamTab';
import { LogErrorsTab } from './LogErrorsTab';
import type { LogEntry, Service } from '../../../services/api';
import type { LogListTab } from '../../../pages/LogListPage';

interface LogListMobileViewProps {
  services: Service[];
  filteredServices: Service[];
  latestLogs: Record<string, LogEntry | null>;
  serviceLogs: Record<string, LogEntry[]>;
  loading: boolean;
  error: string | null;
  activeTab: LogListTab;
  searchQuery: string;
  streamLogs: LogEntry[];
  streamLoading: boolean;
  errorLogs: LogEntry[];
  errorsLoading: boolean;
  onTabChange: (tab: LogListTab) => void;
  onSearchChange: (query: string) => void;
  onAddService: () => void;
  onServiceClick: (id: string) => void;
  onRefreshStream: () => void;
  onRefreshErrors: () => void;
}

export function LogListMobileView({
  services,
  filteredServices,
  latestLogs,
  serviceLogs,
  loading,
  error,
  activeTab,
  searchQuery,
  streamLogs,
  streamLoading,
  errorLogs,
  errorsLoading,
  onTabChange,
  onSearchChange,
  onAddService,
  onServiceClick,
  onRefreshStream,
  onRefreshErrors,
}: LogListMobileViewProps) {
  const { t } = useTranslation(['logs', 'common']);
  const allRecentLogs = Object.values(serviceLogs).flat();
  const receivingCount = services.filter((s) => !!latestLogs[s.id]).length;
  const errorCount = allRecentLogs.filter((log) => log.level === 'error').length;
  const warnCount = allRecentLogs.filter((log) => log.level === 'warn').length;

  const tabs: Array<{ key: LogListTab; label: string; icon: string }> = [
    { key: 'services', label: t('logs.list.tabs.services', { defaultValue: '서비스' }), icon: 'article' },
    { key: 'stream', label: t('logs.list.tabs.stream', { defaultValue: '스트림' }), icon: 'receipt_long' },
    { key: 'errors', label: t('logs.list.tabs.errors', { defaultValue: '에러/경고' }), icon: 'error' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('logs.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5 line-clamp-2">{t('logs.subtitle')}</p>
        </div>
        <button
          onClick={onAddService}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-xs font-bold text-primary transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <MaterialIcon name="add" className="text-base" />
          {t('logServices.add.submit')}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <MobileKpi label={t('logs.kpi.services')} value={services.length} />
        <MobileKpi label={t('logs.kpi.receiving')} value={receivingCount} tone="text-emerald-600 dark:text-emerald-400" />
        <MobileKpi label={t('logs.kpi.errors')} value={errorCount} tone={errorCount > 0 ? 'text-red-500' : undefined} />
        <MobileKpi label={t('logs.kpi.warnings')} value={warnCount} tone={warnCount > 0 ? 'text-amber-500' : undefined} />
      </div>

      <div role="tablist" aria-label={t('logs.title')} className="grid grid-cols-3 bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-text-muted-dark'
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-sm" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'services' && (
        <>
          <div className="relative">
            <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('logs.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark text-sm"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-red-500 p-3 text-sm">{t('common.error')}: {error}</div>
          )}

          {!loading && !error && services.length === 0 && (
            <EmptyState
              icon="article"
              title={t('logServices.empty')}
              description={t('logServices.emptyDesc')}
              action={{ label: t('logServices.add.submit'), onClick: onAddService }}
            />
          )}

          {!loading && !error && filteredServices.length > 0 && (
            <div className="space-y-3">
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

          {!loading && !error && services.length > 0 && filteredServices.length === 0 && (
            <div className="py-12 text-center">
              <MaterialIcon name="search_off" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
              <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-2">{t('logs.noResults')}</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'stream' && (
        <LogStreamTab logs={streamLogs} loading={streamLoading} services={services} onRefresh={onRefreshStream} />
      )}

      {activeTab === 'errors' && (
        <LogErrorsTab logs={errorLogs} loading={errorsLoading} services={services} onRefresh={onRefreshErrors} />
      )}
    </div>
  );
}

function MobileKpi({ label, value, tone = 'text-slate-900 dark:text-white' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="shrink-0 min-w-28 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3">
      <p className="text-xs font-medium text-slate-500 dark:text-text-muted-dark truncate">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
