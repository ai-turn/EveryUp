import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { ServiceHealthGrid } from '../../dashboard';
import { CheckHistoryTab } from './CheckHistoryTab';
import { UptimeSummaryTab } from './UptimeSummaryTab';
import type { Service } from '../../../types/service';
import type { CheckEntry, ServiceUptimeSummary } from '../../../services/api';
import type { HealthCheckTab } from '../../../pages/HealthCheckPage';

interface HealthCheckMobileViewProps {
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

export function HealthCheckMobileView({
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
}: HealthCheckMobileViewProps) {
  const { t } = useTranslation(['healthcheck', 'common']);

  const healthyCount = services.filter((s) => s.isActive !== false && s.status === 'healthy').length;
  const attentionCount = services.filter((s) => ['degraded', 'warning', 'offline'].includes(s.status)).length;

  const tabs: Array<{ key: HealthCheckTab; label: string }> = [
    { key: 'services', label: '서비스' },
    { key: 'history', label: '체크 기록' },
    { key: 'uptime', label: '가동률' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('healthcheck.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{t('healthcheck.subtitle')}</p>
        </div>
        <button
          onClick={onAddService}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-xs font-bold text-primary transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <MaterialIcon name="add" className="text-base" />
          {t('healthcheck.addService')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MobileKPI icon="check_circle" label={t('common.healthy')} value={healthyCount} />
        <MobileKPI icon="warning" label={t('healthcheck.kpi.attention')} value={attentionCount} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-bg-surface-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'services' && (
        <>
          {/* Search */}
          <div className="relative">
            <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('healthcheck.searchPlaceholder')}
              aria-label={t('healthcheck.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark text-sm"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* Status filter — scrollable button group */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusFilterChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors shrink-0 ${
                  statusFilter === opt.value
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white dark:bg-bg-surface-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>

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
        </>
      )}

      {activeTab === 'history' && (
        <CheckHistoryTab failures={failures} loading={failuresLoading} />
      )}

      {activeTab === 'uptime' && (
        <UptimeSummaryTab summaries={uptimeSummary} loading={uptimeLoading} days={90} />
      )}
    </div>
  );
}

function MobileKPI({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-3 py-2">
      <div className="flex items-center justify-between text-slate-500 dark:text-text-muted-dark">
        <span className="text-[11px] font-bold">{label}</span>
        <MaterialIcon name={icon} className="text-sm" />
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}
