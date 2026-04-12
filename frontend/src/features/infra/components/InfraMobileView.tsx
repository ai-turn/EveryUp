import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { InfraCard } from './InfraCard';
import type { Resource } from '../../../types/infra';

interface InfraMobileViewProps {
  filteredResources: Resource[];
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

export function InfraMobileView({
  filteredResources,
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
}: InfraMobileViewProps) {
  const { t } = useTranslation(['infra', 'common']);

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">{t('infra.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{t('infra.subtitle')}</p>
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={onAddResource}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-ui-border-dark text-primary font-bold text-sm active:scale-95 transition-transform"
      >
        <MaterialIcon name="add_circle" className="text-lg" />
        {t('infra.addResource')}
      </button>

      {/* Search */}
      <div className="relative">
        <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={t('infra.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-xs font-medium text-slate-700 dark:text-text-muted-dark outline-none cursor-pointer"
        >
          <option value="">{t('common.type')}: {t('common.all')}</option>
          <option value="server">{t('infra.resourceTypes.server')}</option>
          <option value="database">{t('infra.resourceTypes.database')}</option>
          <option value="container">{t('infra.resourceTypes.container')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-xs font-medium text-slate-700 dark:text-text-muted-dark outline-none cursor-pointer"
        >
          <option value="">{t('common.status')}: {t('common.all')}</option>
          <option value="healthy">{t('common.healthy')}</option>
          <option value="warning">{t('common.warning')}</option>
          <option value="critical">{t('common.critical')}</option>
          <option value="error">{t('common.error')}</option>
        </select>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
          <MaterialIcon name="error_outline" className="text-lg shrink-0" />
          <p className="text-xs font-medium flex-1">{t('common.loadError', { defaultValue: 'Failed to load hosts.' })}</p>
          <button onClick={onRetry} className="text-xs font-bold hover:underline cursor-pointer shrink-0">
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      )}

      {/* Resource List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      ) : filteredResources.length > 0 ? (
        <div className="space-y-3">
          {filteredResources.map((resource) => (
            <InfraCard
              key={resource.id}
              resource={resource}
              onClick={() => onResourceClick(resource.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <MaterialIcon name="search_off" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-2">{t('infra.noResults', { defaultValue: 'No hosts match your filters' })}</p>
          <button
            onClick={onClearFilters}
            className="mt-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            {t('common.clearFilters', { defaultValue: 'Clear Filters' })} →
          </button>
        </div>
      )}
    </div>
  );
}
