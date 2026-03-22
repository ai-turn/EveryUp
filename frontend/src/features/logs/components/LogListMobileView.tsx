import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, EmptyState } from '../../../components/common';
import { LogServiceCard } from './LogServiceCard';
import type { Service, LogEntry } from '../../../services/api';

interface LogListMobileViewProps {
  services: Service[];
  filteredServices: Service[];
  latestLogs: Record<string, LogEntry | null>;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddService: () => void;
  onServiceClick: (id: string) => void;
}

export function LogListMobileView({
  services,
  filteredServices,
  latestLogs,
  loading,
  error,
  searchQuery,
  onSearchChange,
  onAddService,
  onServiceClick,
}: LogListMobileViewProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t('logs.title')}</h1>
        <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{t('logs.subtitle')}</p>
      </div>

      {/* Add Button */}
      <button
        onClick={onAddService}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-ui-border-dark text-primary font-bold text-sm active:scale-95 transition-transform"
      >
        <MaterialIcon name="add_circle" className="text-lg" />
        {t('logServices.add.submit', { defaultValue: 'Add Log Service' })}
      </button>

      {/* Collapsible Guide */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon name="menu_book" className="text-lg text-primary" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('logs.guide.title', { defaultValue: 'How to Collect Logs' })}
            </span>
          </div>
          <MaterialIcon
            name={guideOpen ? 'expand_less' : 'expand_more'}
            className="text-lg text-slate-400"
          />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 space-y-3">
            {[
              { step: 1, title: t('logs.guide.step1.title', { defaultValue: 'Create Log Service' }), desc: t('logs.guide.step1.desc', { defaultValue: 'Click "Add Log Service" and enter a name.' }) },
              { step: 2, title: t('logs.guide.step2.title', { defaultValue: 'Choose Collection Method' }), desc: t('logs.guide.step2.desc', { defaultValue: 'Go to the Integration tab and choose your method.' }) },
              { step: 3, title: t('logs.guide.step3.title', { defaultValue: 'Start Receiving Logs' }), desc: t('logs.guide.step3.desc', { defaultValue: 'Error and warning logs will be collected automatically.' }) },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  {step}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h4>
                  <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={t('logs.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-red-500 p-3 text-sm">
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
            onClick: onAddService,
          }}
        />
      )}

      {/* Cards */}
      {!loading && !error && filteredServices.length > 0 && (
        <div className="space-y-3">
          {filteredServices.map((service) => (
            <LogServiceCard
              key={service.id}
              service={service}
              latestLog={latestLogs[service.id]}
              onClick={() => onServiceClick(service.id)}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {!loading && !error && services.length > 0 && filteredServices.length === 0 && (
        <div className="py-12 text-center">
          <MaterialIcon name="search_off" className="text-4xl text-slate-300 dark:text-text-dim-dark" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark mt-2">{t('logs.noResults')}</p>
        </div>
      )}
    </div>
  );
}
