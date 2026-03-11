import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader, EmptyState } from '../components/common';
import { LogServiceCard, LogServiceForm } from '../features/logs';
import { useSidePanel } from '../contexts/SidePanelContext';
import { api, Service } from '../services/api';

export function LogListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openPanel } = useSidePanel();
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.getServices();
      setServices(data.filter((s) => s.type === 'log'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleAddService = () => {
    openPanel(
      t('logServices.add.title', { defaultValue: 'Add Log Service' }),
      <LogServiceForm onSuccess={fetchServices} />
    );
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.tags?.[0] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title={t('logs.title')}
        subtitle={t('logs.subtitle')}
        features={[
          { icon: 'bug_report', label: t('logs.features.errorTracking', { defaultValue: 'Error Tracking' }) },
          { icon: 'notifications_active', label: t('logs.features.alertTrigger', { defaultValue: 'Alert Trigger' }) },
          { icon: 'integration_instructions', label: t('logs.features.loggingLibrary', { defaultValue: 'Logging Library' }) },
        ]}
      >
        <button
          onClick={handleAddService}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-all text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('logServices.add.submit', { defaultValue: 'Add Log Service' })}
        </button>
      </PageHeader>

      {/* How It Works Guide */}
      <div className="mb-8">
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
              <MaterialIcon name="menu_book" className="text-lg text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('logs.guide.title', { defaultValue: 'How to Collect Logs' })}
              </h3>
              <p className="text-xs text-slate-500 dark:text-text-muted-dark">
                {t('logs.guide.subtitle', { defaultValue: 'Collect error logs from your API servers with minimal setup — no SDK required.' })}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="flex gap-3 p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  {t('logs.guide.step1.title', { defaultValue: 'Create Log Service' })}
                </h4>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
                  {t('logs.guide.step1.desc', { defaultValue: 'Click "Add Log Service" and enter a name. An API key will be generated automatically for authentication.' })}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3 p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  {t('logs.guide.step2.title', { defaultValue: 'Choose Collection Method' })}
                </h4>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
                  {t('logs.guide.step2.desc', { defaultValue: 'Go to the Integration tab and choose your method — HTTP Appender for direct library integration, or Log Agent for file-based collection via Docker.' })}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3 p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  {t('logs.guide.step3.title', { defaultValue: 'Start Receiving Logs' })}
                </h4>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
                  {t('logs.guide.step3.desc', { defaultValue: 'Error and warning logs will be collected automatically. Alert rules will trigger notifications via Telegram or Discord.' })}
                </p>
              </div>
            </div>
          </div>

          {/* Supported — two method groups */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* HTTP Appender */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-1 rounded-md">
                <MaterialIcon name="http" className="text-xs" />
                HTTP Appender
              </span>
              {[
                { name: 'Express', lang: 'Node.js', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
                { name: 'Spring Boot', lang: 'Java', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
                { name: 'ASP.NET', lang: '.NET', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
                { name: 'FastAPI', lang: 'Python', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
              ].map((fw) => (
                <span key={fw.name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${fw.color}`}>
                  {fw.name}
                  <span className="opacity-60">({fw.lang})</span>
                </span>
              ))}
            </div>
            {/* Log Agent */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-text-muted-dark bg-slate-100 dark:bg-ui-hover-dark px-2 py-1 rounded-md">
                <MaterialIcon name="smart_toy" className="text-xs" />
                Log Agent
              </span>
              {[
                { name: 'Docker', lang: 'Sidecar', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
                { name: 'systemd', lang: 'VM/EC2', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
                { name: 'Fluent Bit', lang: 'Config', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' },
              ].map((lib) => (
                <span key={lib.name} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${lib.color}`}>
                  {lib.name}
                  <span className="opacity-60">({lib.lang})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('services.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-red-500 p-4">
          {t('common.error')}: {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && services.length === 0 && (
        <EmptyState
          icon="article"
          title={t('logServices.empty', { defaultValue: 'No log services yet' })}
          description={t('logServices.emptyDesc')}
          action={{
            label: t('logServices.add.submit', { defaultValue: 'Add Log Service' }),
            onClick: handleAddService,
          }}
        />
      )}

      {/* Grid */}
      {!loading && !error && filteredServices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <LogServiceCard
              key={service.id}
              service={service}
              onClick={() => navigate(`/logs/${service.id}`)}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {!loading && !error && services.length > 0 && filteredServices.length === 0 && (
        <div className="py-20 text-center">
          <MaterialIcon name="search_off" className="text-5xl text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-text-muted-dark">{t('logs.noResults')}</p>
        </div>
      )}
    </>
  );
}
