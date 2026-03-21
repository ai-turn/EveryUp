import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Toggle } from '../../../components/common';
import { HealthCheckIdentity } from './HealthCheckIdentity';
import { CheckHistoryBar } from './CheckHistoryBar';
import { RealtimeMetrics } from './RealtimeMetrics';
import { ResponseTimeChart } from './ResponseTimeChart';
import { FailureHistory } from './FailureHistory';
import type { Service } from '../../../services/api';

type MobileTab = 'overview' | 'performance' | 'issues';

interface HealthCheckDetailMobileViewProps {
  service: Service;
  serviceId: string;
  refreshKey: number;
  isLive: boolean;
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


export function HealthCheckDetailMobileView({
  service,
  serviceId,
  refreshKey,
  isLive,
  isDeleteDialogOpen,
  isDeleting,
  onLiveToggle,
  onRefresh,
  onManage,
  onDelete,
  onDeleteDialogOpen,
  onDeleteDialogClose,
  getIdentityStatus,
}: HealthCheckDetailMobileViewProps) {
  const { t } = useTranslation(['healthcheck', 'common']);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MobileTab>('overview');

  const tabs: { key: MobileTab; label: string; icon: string }[] = [
    { key: 'overview', label: t('common.overview', { defaultValue: 'Overview' }), icon: 'info' },
    { key: 'performance', label: t('healthcheck.detail.section.performance', { defaultValue: 'Performance' }), icon: 'speed' },
    { key: 'issues', label: t('healthcheck.detail.section.issues', { defaultValue: 'Issues' }), icon: 'report' },
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
          <span className="text-sm font-medium">{t('common.backToList')}</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-chart-surface rounded-lg">
            <Toggle checked={isLive} onChange={onLiveToggle} />
            <span className="text-xs font-medium text-slate-700 dark:text-text-secondary-dark">
              {t('common.live')}
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-chart-surface text-slate-700 dark:text-white active:scale-95 transition-transform"
          >
            <MaterialIcon name="refresh" className="text-lg" />
          </button>
          {service.type !== 'log' && (
            <button
              onClick={onManage}
              className="p-2.5 rounded-lg bg-primary text-white active:scale-95 transition-transform cursor-pointer"
            >
              <MaterialIcon name="edit" className="text-lg" />
            </button>
          )}
          <button
            onClick={onDeleteDialogOpen}
            className="p-2.5 rounded-lg bg-red-500 text-white active:scale-95 transition-transform cursor-pointer"
          >
            <MaterialIcon name="delete" className="text-lg" />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl">
        {tabs.map(tab => (
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

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30">
                <MaterialIcon name="warning" className="text-2xl text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('healthcheck.delete.title', { defaultValue: 'Delete Service' })}
                </h3>
                <p className="text-sm text-slate-500 dark:text-text-muted-dark">
                  {t('healthcheck.delete.subtitle', { defaultValue: 'This action cannot be undone' })}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-text-secondary-dark mb-6">
              {t('healthcheck.delete.confirm', { defaultValue: 'Are you sure you want to delete' })} <span className="font-bold">{service.name}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onDeleteDialogClose}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors disabled:opacity-50"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <MaterialIcon name="sync" className="text-lg animate-spin" />
                    {t('common.deleting', { defaultValue: 'Deleting...' })}
                  </>
                ) : (
                  <>
                    <MaterialIcon name="delete" className="text-lg" />
                    {t('common.delete', { defaultValue: 'Delete' })}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
