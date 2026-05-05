import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader, FilterBar, KPIChip } from '../../../components/common';
import { ServiceHealthGrid } from '../../dashboard';
import { CheckHistoryTab } from './CheckHistoryTab';
import { UptimeSummaryTab } from './UptimeSummaryTab';
import type { Service } from '../../../types/service';
import type { CheckEntry, ServiceUptimeSummary } from '../../../services/api';
import type { HealthCheckTab } from '../../../pages/HealthCheckPage';

interface HealthCheckDesktopViewProps {
  services: Service[];
  loading: boolean;
  error: Error | null;
  searchQuery: string;
  statusFilter: string;
  activeTab: HealthCheckTab;
  refreshKey: number;
  failures: CheckEntry[];
  failuresLoading: boolean;
  uptimeSummary: ServiceUptimeSummary[];
  uptimeLoading: boolean;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: string) => void;
  onTabChange: (tab: HealthCheckTab) => void;
  onAddService: () => void;
}

const STATUS_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'healthy', labelKey: 'common.healthy' },
  { value: 'degraded', labelKey: 'common.degraded' },
  { value: 'warning', labelKey: 'common.warning' },
  { value: 'offline', labelKey: 'common.offline' },
] as const;

export function HealthCheckDesktopView({
  services,
  loading,
  error,
  searchQuery,
  statusFilter,
  activeTab,
  refreshKey,
  failures,
  failuresLoading,
  uptimeSummary,
  uptimeLoading,
  onSearchChange,
  onStatusFilterChange,
  onTabChange,
  onAddService,
}: HealthCheckDesktopViewProps) {
  const { t } = useTranslation(['healthcheck', 'common']);
  const healthyCount = services.filter((s) => s.isActive !== false && s.status === 'healthy').length;
  const attentionCount = services.filter((s) => ['degraded', 'warning', 'offline'].includes(s.status)).length;
  const pausedCount = services.filter((s) => s.isActive === false).length;
  const avgLatency = Math.round(
    services.reduce((sum, s) => sum + Number.parseInt(s.latency, 10), 0) / Math.max(services.length, 1)
  );

  const tabs: Array<{ key: HealthCheckTab; label: string; icon: string }> = [
    { key: 'services', label: '서비스', icon: 'monitor_heart' },
    { key: 'history', label: '체크 기록', icon: 'history' },
    { key: 'uptime', label: '가동률', icon: 'bar_chart' },
  ];

  return (
    <>
      <PageHeader
        title={t('healthcheck.title')}
        subtitle={t('healthcheck.subtitle')}
      >
        <button
          onClick={onAddService}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-bold transition-all text-primary cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('healthcheck.addService')}
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <KPIChip icon="monitor_heart" label={t('healthcheck.kpi.total')} value={services.length} tone="primary" />
        <KPIChip icon="check_circle" label={t('common.healthy')} value={healthyCount} tone="emerald" />
        <KPIChip icon="warning" label={t('healthcheck.kpi.attention')} value={attentionCount} tone={attentionCount > 0 ? 'amber' : 'slate'} />
        <KPIChip icon="speed" label={t('healthcheck.kpi.avgResponse')} value={services.length ? `${avgLatency}ms` : '-'} tone="primary" />
        <KPIChip icon="pause_circle" label={t('healthcheck.kpi.paused')} value={pausedCount} tone={pausedCount > 0 ? 'slate' : 'emerald'} />
      </div>

      <div className="flex items-end border-b border-slate-200 dark:border-ui-border-dark mb-5">
        <div role="tablist" aria-label={t('healthcheck.title')} className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition-colors -mb-px border-b-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-slate-900 dark:text-white border-primary'
                  : 'text-slate-500 dark:text-text-muted-dark border-transparent hover:text-slate-700 dark:hover:text-text-base-dark'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <MaterialIcon name={tab.icon} className="text-sm" />
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'services' && (
        <>
          <FilterBar
            searchValue={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder={t('healthcheck.searchPlaceholder')}
          >
            {/* 버튼 그룹으로 status 필터 */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-ui-hover-dark rounded-lg">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onStatusFilterChange(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === opt.value
                      ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-base-dark'
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </FilterBar>

          <ServiceHealthGrid
            hideHeader
            bare
            servicesOverride={services}
            loadingOverride={loading}
            errorOverride={error}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            activeTab="all"
            refreshKey={refreshKey}
            navigateTo={(id) => `/healthcheck/${id}`}
            onAddClick={onAddService}
          />

          {!loading && !error && pausedCount > 0 && (
            <p className="mt-4 text-xs text-center text-slate-400 dark:text-text-muted-dark">
              일시정지된 서비스 {pausedCount}개 포함
            </p>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <CheckHistoryTab failures={failures} loading={failuresLoading} />
      )}

      {activeTab === 'uptime' && (
        <UptimeSummaryTab summaries={uptimeSummary} loading={uptimeLoading} days={90} />
      )}
    </>
  );
}
