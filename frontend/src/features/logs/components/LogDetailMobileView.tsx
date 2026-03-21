import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Toggle } from '../../../components/common';
import { ErrorLogTable } from './ErrorLogTable';
import { LogServiceIdentity } from './LogServiceIdentity';
import { LogServiceSettings } from './LogServiceSettings';
import { IntegrationPanel } from '../../healthcheck/components/IntegrationPanel';
import type { Service } from '../../../services/api';

type TabKey = 'logs' | 'integration' | 'settings';


interface LogDetailMobileViewProps {
  service: Service;
  serviceId: string;
  refreshKey: number;
  isLive: boolean;
  activeTab: TabKey;
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  revealedKey: string | null;
  revealCountdown: number;
  onTabChange: (tab: TabKey) => void;
  onLiveToggle: (live: boolean) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onDeleteDialogOpen: () => void;
  onDeleteDialogClose: () => void;
  onSettingsClick: () => void;
  onServiceUpdate: (service: Service) => void;
  onApiKeyRegenerated: (newKey: string, maskedKey: string) => void;
  onRevealedKeyClose: () => void;
  onCopyKey: (key: string) => void;
}

export function LogDetailMobileView({
  service,
  serviceId,
  refreshKey,
  isLive,
  activeTab,
  isDeleteDialogOpen,
  isDeleting,
  revealedKey,
  revealCountdown,
  onTabChange,
  onLiveToggle,
  onRefresh,
  onDelete,
  onDeleteDialogOpen,
  onDeleteDialogClose,
  onSettingsClick,
  onServiceUpdate,
  onApiKeyRegenerated,
  onRevealedKeyClose,
  onCopyKey,
}: LogDetailMobileViewProps) {
  const { t } = useTranslation(['logs', 'common']);
  const navigate = useNavigate();
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'logs', label: t('logServices.detail.tabs.logs'), icon: 'article' },
    { key: 'integration', label: t('logServices.detail.tabs.integration'), icon: 'integration_instructions' },
    { key: 'settings', label: t('logServices.detail.tabs.settings'), icon: 'tune' },
  ];

  return (
    <div className="space-y-4">
      {/* Nav Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/logs')}
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
          <button
            onClick={onDeleteDialogOpen}
            className="p-2.5 rounded-lg bg-red-500 text-white active:scale-95 transition-transform cursor-pointer"
          >
            <MaterialIcon name="delete" className="text-lg" />
          </button>
        </div>
      </div>

      {/* Service Identity */}
      <LogServiceIdentity service={service} onSettingsClick={onSettingsClick} />

      {/* Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
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
      {activeTab === 'logs' && (
        <ErrorLogTable serviceId={serviceId} refreshKey={refreshKey} />
      )}
      {activeTab === 'integration' && (
        <IntegrationPanel service={service} onApiKeyRegenerated={onApiKeyRegenerated} />
      )}
      {activeTab === 'settings' && (
        <LogServiceSettings service={service} onSuccess={onServiceUpdate} />
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
                  {t('logServices.delete.title')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-text-muted-dark">
                  {t('logServices.delete.subtitle')}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-text-secondary-dark mb-6">
              {t('logServices.delete.confirm')} <span className="font-bold">{service.name}</span>?
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

      {/* Revealed API Key Modal */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/30">
                <MaterialIcon name="key" className="text-xl text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('logServices.apiKey.revealTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('logServices.apiKey.revealDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-4">
              <span className="flex-1 text-slate-700 dark:text-text-base-dark break-all select-all">
                {revealedKey}
              </span>
              <button
                onClick={() => onCopyKey(revealedKey)}
                className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark"
              >
                <MaterialIcon name="content_copy" className="text-base" />
              </button>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <MaterialIcon name="warning" className="text-sm" />
                {t('logServices.apiKey.revealOnce')}
              </p>
            </div>
            <button
              onClick={onRevealedKeyClose}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {t('logServices.apiKey.revealConfirm')}
              {revealCountdown > 0 && ` (${revealCountdown}s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
