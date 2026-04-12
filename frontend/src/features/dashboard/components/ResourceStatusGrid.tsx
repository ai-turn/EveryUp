import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { InfraCard } from '../../infra/components/InfraCard';
import { useMonitoringResources } from '../../../hooks/useInfra';

const MAX_ITEMS = 3;

export function ResourceStatusGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation(['dashboard', 'common']);
  const { data: resources, loading, error, refetch } = useMonitoringResources();

  const items = resources || [];
  const displayItems = items.slice(0, MAX_ITEMS);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('dashboard.infrastructure.title', { defaultValue: 'Infrastructure' })}
          </h2>
          {!loading && items.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        {!loading && !error && items.length > 0 && (
          <button
            onClick={() => navigate('/infra')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {t('common.viewMore', { defaultValue: 'Go to' })}
            <MaterialIcon name="arrow_forward" className="text-sm" />
          </button>
        )}
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <MaterialIcon name="error_outline" className="text-lg text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{t('common.loadError', { defaultValue: 'Failed to load' })}</p>
          <button onClick={refetch} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer shrink-0">
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
          <EmptyState
            icon="dns"
            title={t('dashboard.infrastructure.empty', { defaultValue: 'No resources registered' })}
            description={t('dashboard.infrastructure.emptyDesc', { defaultValue: 'Add a server to start monitoring CPU, memory, and disk.' })}
            action={{
              label: t('dashboard.infrastructure.add'),
              onClick: () => navigate('/infra'),
            }}
          />
        </div>
      )}

      {/* Grid */}
      {!loading && displayItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {displayItems.map((resource) => (
            <InfraCard
              key={resource.id}
              resource={resource}
              onClick={() => navigate(`/infra/${resource.id}`)}
            />
          ))}
        </div>
      )}


      <div className="mt-8 mx-6 h-px bg-slate-200 dark:bg-ui-border-dark" />
    </div>
  );
}
