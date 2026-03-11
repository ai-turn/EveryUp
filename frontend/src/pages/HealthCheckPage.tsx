import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, PageHeader } from '../components/common';
import { ServiceHealthGrid } from '../features/dashboard';
import { useSidePanel } from '../contexts/SidePanelContext';
import { HealthCheckForm } from '../features/healthcheck/components/HealthCheckForm';

export function HealthCheckPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { openPanel } = useSidePanel();
  const [refreshKey, setRefreshKey] = useState(0);

  const location = useLocation();

  const handleServiceAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleAddService = () => {
    openPanel(
      t('dashboard.addService'),
      <HealthCheckForm onSuccess={handleServiceAdded} />
    );
  };

  useEffect(() => {
    if (location.state?.openAddModal) {
      handleAddService();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <>
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        features={[
          { icon: 'monitor_heart', label: t('services.features.httpStatus') },
          { icon: 'speed', label: t('services.features.responseTime') },
          { icon: 'show_chart', label: t('services.features.uptime') },
          { icon: 'notifications', label: t('services.features.alerting') },
          { icon: 'schedule', label: t('services.features.scheduledChecks') },
        ]}
      >
        <button
          onClick={handleAddService}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-all text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('dashboard.addService')}
        </button>
      </PageHeader>

      {/* Search and Filters */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('services.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">{t('common.status')}: {t('common.all')}</option>
          <option value="healthy">{t('common.healthy')}</option>
          <option value="degraded">{t('common.degraded')}</option>
          <option value="warning">{t('common.warning')}</option>
          <option value="offline">{t('common.offline')}</option>
        </select>
      </div>

      <ServiceHealthGrid
        hideHeader
        bare
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        refreshKey={refreshKey}
        navigateTo={(id) => `/healthcheck/${id}`}
        onAddClick={handleAddService}
      />
    </>
  );
}
