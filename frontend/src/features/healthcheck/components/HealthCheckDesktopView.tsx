import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon, PageHeader } from '../../../components/common';
import { ServiceHealthGrid } from '../../dashboard';

interface HealthCheckDesktopViewProps {
  searchQuery: string;
  statusFilter: string;
  refreshKey: number;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: string) => void;
  onAddService: () => void;
}

export function HealthCheckDesktopView({
  searchQuery,
  statusFilter,
  refreshKey,
  onSearchChange,
  onStatusFilterChange,
  onAddService,
}: HealthCheckDesktopViewProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');

  return (
    <>
      <PageHeader
        title={t('헬스체크')}
        subtitle={t('헬스체크 실시간 상태 모니터링')}
        features={[
          { icon: 'monitor_heart', label: t('HTTP 상태 체크') },
          { icon: 'speed', label: t('응답 시간 추적') },
          { icon: 'show_chart', label: t('가동률 통계') },
          { icon: 'notifications', label: t('임계값 알림') },
          { icon: 'schedule', label: t('헬스체크 스케줄링') },
        ]}
      >
        <button
          onClick={onAddService}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-all text-white shadow-sm hover:shadow-md cursor-pointer active:scale-95"
        >
          <MaterialIcon name="add" className="text-lg" />
          {t('헬스체크 추가')}
        </button>
      </PageHeader>

      {/* Search and Filters */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('헬스체크 검색...')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-medium text-slate-700 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
        >
          <option value="">{tc('common.status')}: {tc('common.all')}</option>
          <option value="healthy">{tc('common.healthy')}</option>
          <option value="degraded">{tc('common.degraded')}</option>
          <option value="warning">{tc('common.warning')}</option>
          <option value="offline">{tc('common.offline')}</option>
        </select>
      </div>

      <ServiceHealthGrid
        hideHeader
        bare
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        refreshKey={refreshKey}
        navigateTo={(id) => `/healthcheck/${id}`}
        onAddClick={onAddService}
      />
    </>
  );
}
