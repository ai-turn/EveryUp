import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { LogServiceCard } from '../../logs';
import { api, Service, LogEntry } from '../../../services/api';

const MAX_ITEMS = 3;

export function LogServicesGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestLogs, setLatestLogs] = useState<Record<string, LogEntry | null>>({});

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.getServices();
      setServices(data.filter((s) => s.type === 'log'));
    } catch {
      // silently fail — dashboard card is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    if (services.length === 0) return;
    services.slice(0, MAX_ITEMS).forEach(async (svc) => {
      try {
        const logs = await api.getServiceLogs(svc.id, { limit: '1' });
        setLatestLogs(prev => ({ ...prev, [svc.id]: logs[0] ?? null }));
      } catch {
        setLatestLogs(prev => ({ ...prev, [svc.id]: null }));
      }
    });
  }, [services]);

  const displayItems = services.slice(0, MAX_ITEMS);
  const hasMore = services.length > MAX_ITEMS;

  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('nav.logs')}
          </h2>
          {!loading && services.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
              {services.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/logs')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium transition-all shadow-sm"
        >
          <MaterialIcon name="add" className="text-sm" />
          {t('logServices.add.submit', { defaultValue: 'Add Log Service' })}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && services.length === 0 && (
        <EmptyState
          icon="article"
          title={t('dashboard.logServices.empty', { defaultValue: 'No log services yet' })}
          description={t('dashboard.logServices.emptyDesc', { defaultValue: 'Add a log service to collect and analyze error logs from your APIs.' })}
          action={{
            label: t('logServices.add.submit', { defaultValue: 'Add Log Service' }),
            onClick: () => navigate('/logs'),
          }}
        />
      )}

      {/* Grid */}
      {!loading && displayItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {displayItems.map((service) => (
            <LogServiceCard
              key={service.id}
              service={service}
              latestLog={latestLogs[service.id] ?? null}
              onClick={() => navigate(`/logs/${service.id}`)}
            />
          ))}
        </div>
      )}

      {/* View More */}
      {!loading && hasMore && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-ui-border-dark/50 text-center">
          <button
            onClick={() => navigate('/logs')}
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
