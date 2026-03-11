import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { IconHealthCheck } from '../../../components/icons/SidebarIcons';
import { ServiceCard } from './ServiceCard';
import { useDashboardServices } from '../../../hooks/useData';
import { ServiceCardSkeleton } from '../../../components/skeleton';

interface ServiceHealthGridProps {
  hideHeader?: boolean;
  bare?: boolean;
  searchQuery?: string;
  statusFilter?: string;
  refreshKey?: number;
  navigateTo?: (serviceId: string) => string;
  maxItems?: number;
  onAddClick?: () => void;
}

export function ServiceHealthGrid({
  hideHeader = false,
  bare = false,
  searchQuery = '',
  statusFilter = '',
  refreshKey = 0,
  navigateTo = (id) => `/healthcheck/${id}`,
  maxItems,
  onAddClick,
}: ServiceHealthGridProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: services, loading, error, refetch } = useDashboardServices();

  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const filteredServices = (services || []).filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cluster.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const displayServices = maxItems ? filteredServices.slice(0, maxItems) : filteredServices;
  const hasMore = maxItems ? filteredServices.length > maxItems : false;

  return (
    <div className={bare ? '' : 'bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6'}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <IconHealthCheck size={20} className="text-primary" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dashboard.healthCheck.title')}
            </h2>
            {!loading && services && services.length > 0 && (
              <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
                {services.length}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/healthcheck', { state: { openAddModal: true } })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium transition-all shadow-sm"
            >
              <MaterialIcon name="add" className="text-sm" />
              {t('dashboard.addService')}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-red-500 p-4">
          {t('common.error')}: {error.message}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && (!services || services.length === 0) && (
        <EmptyState
          icon="monitor_heart"
          title={t('dashboard.emptyState')}
          description={t('dashboard.emptyStateDesc', { defaultValue: 'Add your first service to start monitoring.' })}
          action={{
            label: t('dashboard.addService'),
            onClick: onAddClick ?? (() => navigate('/healthcheck')),
          }}
        />
      )}

      {/* Grid */}
      {!loading && !error && displayServices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {displayServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onClick={() => navigate(navigateTo(service.id))}
            />
          ))}
        </div>
      )}

      {/* View More */}
      {!loading && !error && hasMore && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ui-border-dark/50 text-center">
          <button
            onClick={() => navigate('/healthcheck')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {t('common.viewMore', { defaultValue: 'View More' })}
            <MaterialIcon name="arrow_forward" className="text-sm" />
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && services && services.length > 0 && filteredServices.length === 0 && (
        <div className="py-20 text-center">
          <MaterialIcon name="search_off" className="text-5xl text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-text-muted-dark">{t('logs.noResults')}</p>
        </div>
      )}
    </div>
  );
}
