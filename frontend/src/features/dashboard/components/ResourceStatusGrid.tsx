import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { IconInfra } from '../../../components/icons/SidebarIcons';
import { InfraCard } from '../../infra/components/InfraCard';
import { useMonitoringResources } from '../../../hooks/useData';

const MAX_ITEMS = 3;

export function ResourceStatusGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: resources, loading } = useMonitoringResources();

  const items = resources || [];
  const displayItems = items.slice(0, MAX_ITEMS);
  const hasMore = items.length > MAX_ITEMS;

  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <IconInfra size={20} className="text-primary" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('dashboard.infrastructure.title', { defaultValue: 'Infrastructure' })}
          </h2>
          {!loading && items.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/infra', { state: { openAddModal: true } })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium transition-all shadow-sm"
        >
          <MaterialIcon name="add" className="text-sm" />
          {t('monitoring.addResource')}
        </button>
      </div>

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
        <EmptyState
          icon="dns"
          title={t('dashboard.infrastructure.empty', { defaultValue: 'No resources registered' })}
          description={t('dashboard.infrastructure.emptyDesc', { defaultValue: 'Add a server to start monitoring CPU, memory, and disk.' })}
          action={{
            label: t('monitoring.addResource'),
            onClick: () => navigate('/infra'),
          }}
        />
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

      {/* View More */}
      {!loading && hasMore && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ui-border-dark/50 text-center">
          <button
            onClick={() => navigate('/infra')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {t('common.viewMore', { defaultValue: 'View More' })}
            <MaterialIcon name="arrow_forward" className="text-sm" />
          </button>
        </div>
      )}
    </div>
  );
}
