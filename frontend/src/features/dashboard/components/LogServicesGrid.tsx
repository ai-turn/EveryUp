import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { LogServiceCard } from '../../logs';
import { api, Service, LogEntry } from '../../../services/api';

const MAX_ITEMS = 3;

export function LogServicesGrid() {
  const navigate = useNavigate();
  const { t } = useTranslation(['dashboard', 'common']);
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('dashboard.logs.title')}
          </h2>
          {!loading && services.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-0.5 rounded-full">
              {services.length}
            </span>
          )}
        </div>
        {!loading && services.length > 0 && (
          <button
            onClick={() => navigate('/logs')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {t('common.viewMore', { defaultValue: 'Go to' })}
            <MaterialIcon name="arrow_forward" className="text-sm" />
          </button>
        )}
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
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
          <EmptyState
            icon="article"
            title={t('dashboard.logs.empty', { defaultValue: 'No log services yet' })}
            description={t('dashboard.logs.emptyDesc', { defaultValue: 'Add a log service to collect and analyze error logs from your APIs.' })}
            action={{
              label: t('dashboard.logs.add'),
              onClick: () => navigate('/logs'),
            }}
          />
        </div>
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


      <div className="mt-6 mx-6 h-px bg-slate-200 dark:bg-ui-border-dark" />
    </div>
  );
}
