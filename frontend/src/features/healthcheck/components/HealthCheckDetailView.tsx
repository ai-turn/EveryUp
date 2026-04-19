import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { MaterialIcon, Toggle } from '../../../components/common';
import { Breadcrumbs } from '../../../components/layout/Breadcrumbs';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { HealthCheckIdentity } from './HealthCheckIdentity';
import { CheckHistoryBar } from './CheckHistoryBar';
import { RealtimeMetrics } from './RealtimeMetrics';
import { ResponseTimeChart } from './ResponseTimeChart';
import { FailureHistory } from './FailureHistory';
import type { Service } from '../../../services/api';

type MobileTab = 'overview' | 'performance' | 'issues';

export interface HealthCheckDetailViewProps {
  service: Service;
  serviceId: string;
  refreshKey: number;
  isLive: boolean;
  lastUpdated: Date;
  dateLocale: Locale;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  onLiveToggle: (live: boolean) => void;
  onRefresh: () => void;
  onManage: () => void;
  onDelete: () => void;
  onDeleteDialogOpen: () => void;
  onDeleteDialogClose: () => void;
  getIdentityStatus: (status: Service['status']) => 'online' | 'offline' | 'degraded';
}

// --- 공통 서브컴포넌트 ---

function ServiceContent({
  service,
  serviceId,
  refreshKey,
  getIdentityStatus,
}: Pick<HealthCheckDetailViewProps, 'service' | 'serviceId' | 'refreshKey' | 'getIdentityStatus'>) {
  const { t } = useTranslate();
  return (
    <>
      <HealthCheckIdentity
        name={service.name}
        endpoint={service.url || service.host || '-'}
        lastCheckedAt={service.lastCheckedAt}
        type={service.type as 'http' | 'tcp'}
        status={getIdentityStatus(service.status)}
        scheduleType={service.scheduleType}
        interval={service.interval}
        timeout={service.timeout}
        cronExpression={service.cronExpression}
      />
      <CheckHistoryBar serviceId={serviceId} refreshKey={refreshKey} />

      <div className="flex items-center gap-2 mt-2 mb-4">
        <MaterialIcon name="analytics" className="text-base text-slate-400 dark:text-text-dim-dark" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-text-dim-dark">
          {t('성능')}
        </h2>
        <div className="flex-1 border-t border-slate-200 dark:border-ui-border-dark" />
      </div>
      <RealtimeMetrics serviceId={serviceId} refreshKey={refreshKey} />
      <ResponseTimeChart serviceId={serviceId} refreshKey={refreshKey} timeout={service.timeout} />

      <div className="flex items-center gap-2 mt-2 mb-4">
        <MaterialIcon name="report" className="text-base text-slate-400 dark:text-text-dim-dark" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-text-dim-dark">
          {t('장애')}
        </h2>
        <div className="flex-1 border-t border-slate-200 dark:border-ui-border-dark" />
      </div>
      <FailureHistory serviceId={serviceId} refreshKey={refreshKey} />
    </>
  );
}

function DeleteDialog({
  service,
  isDeleting,
  onClose,
  onDelete,
}: {
  service: Service;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
            <MaterialIcon name="warning" className="text-2xl text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('헬스체크 삭제')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark">
              {t('이 작업은 되돌릴 수 없습니다')}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-text-secondary-dark mb-6">
          {t('정말 삭제하시겠습니까?')}{' '}
          <span className="font-bold">{service.name}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors disabled:opacity-50"
          >
            {tc('common.cancel')}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <MaterialIcon name="sync" className="text-lg animate-spin" />
                {tc('common.deleting')}
              </>
            ) : (
              <>
                <MaterialIcon name="delete" className="text-lg" />
                {tc('common.delete')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 데스크톱 레이아웃 ---

function DesktopLayout(props: HealthCheckDetailViewProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');
  const {
    service, serviceId, refreshKey, isLive, lastUpdated, dateLocale,
    isDeleteDialogOpen, isDeleting,
    onLiveToggle, onRefresh, onManage, onDelete, onDeleteDialogOpen, onDeleteDialogClose,
    getIdentityStatus,
  } = props;

  return (
    <>
      {/* Breadcrumbs & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <Breadcrumbs items={[{ label: tc('common.backToList'), href: '/healthcheck' }]} />
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-chart-surface rounded-lg p-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <Toggle checked={isLive} onChange={onLiveToggle} />
            {isLive && (
              <span className="hidden sm:inline text-xs text-slate-400 dark:text-text-muted-dark">
                {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: dateLocale })}
              </span>
            )}
          </div>
          <div className="w-px h-5 bg-slate-300 dark:bg-ui-active-dark mx-0.5" />

          <div className="relative group">
            <button onClick={onRefresh} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-600 dark:text-text-secondary-dark">
              <MaterialIcon name="refresh" className="text-lg" />
            </button>
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              {tc('common.refresh')}
            </div>
          </div>

          {service.type !== 'log' && (
            <div className="relative group">
              <button onClick={onManage} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-600 dark:text-text-secondary-dark">
                <MaterialIcon name="edit" className="text-lg" />
              </button>
              <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                {t('헬스체크 관리')}
              </div>
            </div>
          )}

          <div className="relative group">
            <button onClick={onDeleteDialogOpen} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500">
              <MaterialIcon name="delete" className="text-lg" />
            </button>
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              {tc('common.delete')}
            </div>
          </div>
        </div>
      </div>

      <ServiceContent service={service} serviceId={serviceId} refreshKey={refreshKey} getIdentityStatus={getIdentityStatus} />

      {isDeleteDialogOpen && (
        <DeleteDialog service={service} isDeleting={isDeleting} onClose={onDeleteDialogClose} onDelete={onDelete} />
      )}
    </>
  );
}

// --- 모바일 레이아웃 ---

function MobileLayout(props: HealthCheckDetailViewProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MobileTab>('overview');
  const {
    service, serviceId, refreshKey, isLive,
    isDeleteDialogOpen, isDeleting,
    onLiveToggle, onRefresh, onManage, onDelete, onDeleteDialogOpen, onDeleteDialogClose,
    getIdentityStatus,
  } = props;

  const tabs: { key: MobileTab; label: string; icon: string }[] = [
    { key: 'overview',     label: tc('common.overview'), icon: 'info'   },
    { key: 'performance',  label: t('성능'),              icon: 'speed'  },
    { key: 'issues',       label: t('장애'),              icon: 'report' },
  ];

  return (
    <div className="space-y-4">
      {/* Nav Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/healthcheck')}
          className="flex items-center gap-1 text-slate-500 dark:text-text-muted-dark active:opacity-60 transition-opacity cursor-pointer"
        >
          <MaterialIcon name="arrow_back" className="text-lg" />
          <span className="text-sm font-medium">{tc('common.backToList')}</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-chart-surface rounded-lg">
            <Toggle checked={isLive} onChange={onLiveToggle} />
            <span className="text-xs font-medium text-slate-700 dark:text-text-secondary-dark">
              {tc('common.live')}
            </span>
          </div>
          <button onClick={onRefresh} className="p-2.5 rounded-lg bg-slate-100 dark:bg-chart-surface text-slate-700 dark:text-white active:scale-95 transition-transform">
            <MaterialIcon name="refresh" className="text-lg" />
          </button>
          {service.type !== 'log' && (
            <button onClick={onManage} className="p-2.5 rounded-lg bg-primary text-white active:scale-95 transition-transform cursor-pointer">
              <MaterialIcon name="edit" className="text-lg" />
            </button>
          )}
          <button onClick={onDeleteDialogOpen} className="p-2.5 rounded-lg bg-red-500 text-white active:scale-95 transition-transform cursor-pointer">
            <MaterialIcon name="delete" className="text-lg" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-text-muted-dark'
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-sm" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <HealthCheckIdentity
            name={service.name}
            endpoint={service.url || service.host || '-'}
            lastCheckedAt={service.lastCheckedAt}
            type={service.type as 'http' | 'tcp'}
            status={getIdentityStatus(service.status)}
            scheduleType={service.scheduleType}
            interval={service.interval}
            timeout={service.timeout}
            cronExpression={service.cronExpression}
          />
          <CheckHistoryBar serviceId={serviceId} refreshKey={refreshKey} />
        </div>
      )}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <RealtimeMetrics serviceId={serviceId} refreshKey={refreshKey} />
          <ResponseTimeChart serviceId={serviceId} refreshKey={refreshKey} timeout={service.timeout} />
        </div>
      )}
      {activeTab === 'issues' && (
        <FailureHistory serviceId={serviceId} refreshKey={refreshKey} />
      )}

      {isDeleteDialogOpen && (
        <DeleteDialog service={service} isDeleting={isDeleting} onClose={onDeleteDialogClose} onDelete={onDelete} />
      )}
    </div>
  );
}

// --- 진입점: 내부적으로 모바일 감지 후 레이아웃 분기 ---

export function HealthCheckDetailView(props: HealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
