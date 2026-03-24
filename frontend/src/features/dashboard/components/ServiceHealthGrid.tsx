import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
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
  const { t } = useTranslation(['dashboard', 'common']);
  const { data: services, loading, error, refetch } = useDashboardServices();

  useEffect(() => {
    if (refreshKey > 0) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const filteredServices = (services || []).filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const displayServices = maxItems ? filteredServices.slice(0, maxItems) : filteredServices;

  return (
    <div>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-6 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('dashboard.healthCheck.title')}
            </h2>
            {!loading && services && services.length > 0 && (
              <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
                {services.length}
              </span>
            )}
          </div>
          {!loading && !error && services && services.length > 0 && (
            <button
              onClick={() => navigate('/healthcheck')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              {t('common.viewMore', { defaultValue: 'Go to' })}
              <MaterialIcon name="arrow_forward" className="text-sm" />
            </button>
          )}
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
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
          <EmptyState
            icon="monitor_heart"
            title={t('dashboard.healthCheck.empty')}
            description={t('dashboard.healthCheck.emptyDesc')}
            action={{
              label: t('dashboard.healthCheck.add'),
              onClick: onAddClick ?? (() => navigate('/healthcheck')),
            }}
          />
        </div>
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


      {/* No search results */}
      {!loading && !error && services && services.length > 0 && filteredServices.length === 0 && (
        <div className="py-20 text-center">
          <MaterialIcon name="search_off" className="text-5xl text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-text-muted-dark">{t('logs.noResults')}</p>
        </div>
      )}

      {!bare && <div className="mt-6 mx-6 h-px bg-slate-200 dark:bg-ui-border-dark" />}
    </div>
  );
}
