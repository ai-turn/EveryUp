import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader, EmptyState } from '../../../components/common';
import { LogServiceCard } from './LogServiceCard';
import type { Service } from '../../../services/api';

interface LogListDesktopViewProps {
  services: Service[];
  filteredServices: Service[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddService: () => void;
  onServiceClick: (id: string) => void;
}

export function LogListDesktopView({
  services,
  filteredServices,
  loading,
  error,
  searchQuery,
  onSearchChange,
  onAddService,
  onServiceClick,
}: LogListDesktopViewProps) {
  const { t } = useTranslation(['logs', 'common']);

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
          onClick={onAddService}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-all text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('logServices.add.submit', { defaultValue: 'Add Log Service' })}
        </button>
      </PageHeader>

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
              <p className="text-sm text-slate-500 dark:text-text-muted-dark">
                {t('logs.guide.subtitle', { defaultValue: 'Start collecting logs with your existing logger configuration or log files. No separate SDK is required.' })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: t('logs.guide.step1.title', { defaultValue: 'Create a Log Service' }),
                desc: t('logs.guide.step1.desc', { defaultValue: 'Click "Add Log Service" and create a service name. A dedicated API key is generated automatically.' }),
              },
              {
                step: 2,
                title: t('logs.guide.step2.title', { defaultValue: 'Choose an Integration Method' }),
                desc: t('logs.guide.step2.desc', { defaultValue: 'Open the Integration tab and choose the method that fits your environment. Use HTTP Appender when you can edit app code, or Log Agent when you want to collect log files or stdout from servers and containers.' }),
              },
              {
                step: 3,
                title: t('logs.guide.step3.title', { defaultValue: 'Review Logs and Add Alerts' }),
                desc: t('logs.guide.step3.desc', { defaultValue: 'Collected logs appear in the log list right away. If needed, add Telegram or Discord alert rules for error and warn logs.' }),
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3 p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold shrink-0">
                  {step}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{title}</h4>
                  <p className="text-sm text-slate-500 dark:text-text-muted-dark leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  {fw.name} <span className="opacity-60">({fw.lang})</span>
                </span>
              ))}
            </div>
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
                  {lib.name} <span className="opacity-60">({lib.lang})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="relative max-w-md">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('logs.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="text-red-500 p-4">
          {t('common.error')}: {error}
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <EmptyState
          icon="article"
          title={t('logServices.empty', { defaultValue: 'No log services yet' })}
          description={t('logServices.emptyDesc')}
          action={{
            label: t('logServices.add.submit', { defaultValue: 'Add Log Service' }),
            onClick: onAddService,
          }}
        />
      )}

      {!loading && !error && filteredServices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <LogServiceCard
              key={service.id}
              service={service}
              onClick={() => onServiceClick(service.id)}
            />
          ))}
        </div>
      )}

      {!loading && !error && services.length > 0 && filteredServices.length === 0 && (
        <div className="py-20 text-center">
          <MaterialIcon name="search_off" className="text-5xl text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-text-muted-dark">{t('logs.noResults')}</p>
        </div>
      )}
    </>
  );
}
