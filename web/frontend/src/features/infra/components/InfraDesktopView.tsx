import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader, FilterBar, KPIChip } from '../../../components/common';
import { InfraCard } from './InfraCard';
import { Skeleton } from '../../../components/skeleton';
import type { Resource } from '../../../types/infra';

interface InfraDesktopViewProps {
  resources: Resource[];
  filteredResources: Resource[];
  incidentCount: number;
  remoteCount: number;
  loading: boolean;
  error: Error | string | null;
  searchQuery: string;
  typeFilter: string;
  statusFilter: string;
  onSearchChange: (query: string) => void;
  onTypeFilterChange: (filter: string) => void;
  onStatusFilterChange: (filter: string) => void;
  onClearFilters: () => void;
  onAddResource: () => void;
  onResourceClick: (id: string) => void;
  onRetry: () => void;
}

export function InfraDesktopView({
  resources,
  filteredResources,
  incidentCount,
  remoteCount,
  loading,
  error,
  searchQuery,
  typeFilter,
  statusFilter,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onClearFilters,
  onAddResource,
  onResourceClick,
  onRetry,
}: InfraDesktopViewProps) {
  const { t } = useTranslation(['infra', 'common']);
  const pausedCount = resources.filter(r => r.isActive === false).length;
  const healthyCount = resources.filter(r => r.status === 'healthy').length;

  return (
    <>
      <PageHeader
        title={t('infra.title')}
        subtitle={t('infra.subtitle')}
      >
        <button
          onClick={onAddResource}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm font-bold text-primary transition-all cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('infra.addResource')}
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <KPIChip label={t('infra.kpi.total')} value={resources.length} tone="primary" icon="dns" />
        <KPIChip label={t('infra.kpi.healthy')} value={healthyCount} tone="emerald" icon="check_circle" />
        <KPIChip label={t('infra.kpi.incidents')} value={incidentCount} tone={incidentCount > 0 ? 'amber' : 'slate'} icon="warning" />
        <KPIChip label={t('infra.kpi.paused')} value={pausedCount} tone={pausedCount > 0 ? 'slate' : 'emerald'} icon="pause_circle" />
        <KPIChip label={t('infra.kpi.remote')} value={remoteCount} tone="primary" icon="key" />
      </div>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('infra.searchPlaceholder')}
      >
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="">{t('common.type')}: {t('common.all')}</option>
            <option value="server">{t('infra.resourceTypes.server')}</option>
            <option value="database">{t('infra.resourceTypes.database')}</option>
            <option value="container">{t('infra.resourceTypes.container')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="">{t('common.status')}: {t('common.all')}</option>
            <option value="healthy">{t('common.healthy')}</option>
            <option value="warning">{t('common.warning')}</option>
            <option value="critical">{t('common.critical')}</option>
            <option value="error">{t('common.error')}</option>
            <option value="paused">{t('common.paused')}</option>
            <option value="unknown">{t('common.unknown')}</option>
          </select>
        </div>
      </FilterBar>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <MaterialIcon name="error_outline" className="text-xl shrink-0" />
          <p className="text-sm font-medium flex-1">{t('common.loadError')}</p>
          <button onClick={onRetry} className="text-sm font-bold hover:underline cursor-pointer shrink-0">
            {t('common.retry')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredResources.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredResources.map((resource) => (
            <InfraCard
              key={resource.id}
              resource={resource}
              onClick={() => onResourceClick(resource.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center border border-dashed border-slate-200 dark:border-ui-border-dark rounded-2xl bg-slate-50/50 dark:bg-bg-surface-dark/50">
          <MaterialIcon name="search_off" className="text-5xl text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-text-muted-dark font-medium">{t('infra.noResults')}</p>
          <button
            onClick={onClearFilters}
            className="mt-3 text-sm font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            {t('common.clearFilters')}
          </button>
        </div>
      )}
    </>
  );
}
