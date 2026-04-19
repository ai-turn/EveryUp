import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../../components/common';
import { ServiceHealthGrid } from '../../dashboard';

interface HealthCheckMobileViewProps {
  searchQuery: string;
  statusFilter: string;
  refreshKey: number;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: string) => void;
  onAddService: () => void;
}

export function HealthCheckMobileView({
  searchQuery,
  statusFilter,
  refreshKey,
  onSearchChange,
  onStatusFilterChange,
  onAddService,
}: HealthCheckMobileViewProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">{t('헬스체크')}</h1>
        <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{t('헬스체크 실시간 상태 모니터링')}</p>
      </div>

      {/* Add Button */}
      <button
        onClick={onAddService}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-ui-border-dark text-primary font-bold text-sm active:scale-95 transition-transform"
      >
        <MaterialIcon name="add_circle" className="text-lg" />
        {t('헬스체크 추가')}
      </button>

      {/* Search */}
      <div className="relative">
        <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={t('헬스체크 검색...')}
          aria-label={t('헬스체크 검색...')}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="w-full px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-xs font-medium text-slate-700 dark:text-text-muted-dark outline-none cursor-pointer"
      >
        <option value="">{tc('common.status')}: {tc('common.all')}</option>
        <option value="healthy">{tc('common.healthy')}</option>
        <option value="degraded">{tc('common.degraded')}</option>
        <option value="warning">{tc('common.warning')}</option>
        <option value="offline">{tc('common.offline')}</option>
      </select>

      <ServiceHealthGrid
        hideHeader
        bare
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        refreshKey={refreshKey}
        navigateTo={(id) => `/healthcheck/${id}`}
        onAddClick={onAddService}
      />
    </div>
  );
}
