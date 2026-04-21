import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import type { Locale } from 'date-fns';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon, Toggle } from '../../../components/common';
import { Breadcrumbs } from '../../../components/layout/Breadcrumbs';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { ErrorLogTable } from './ErrorLogTable';
import { LogServiceIdentity } from './LogServiceIdentity';
import { LogServiceSettings } from './LogServiceSettings';
import { IntegrationPanel } from './IntegrationPanel';
import { RequestsTab } from '../../api-requests/components/RequestsTab';
import { api } from '../../../services/api';
import type { Service } from '../../../services/api';

type TabKey = 'logs' | 'requests' | 'integration' | 'settings';

export interface LogDetailViewProps {
  service: Service;
  serviceId: string;
  refreshKey: number;
  isLive: boolean;
  lastUpdated: Date;
  dateLocale: Locale;
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

// --- 공통 서브컴포넌트 ---

function TabBar({
  tabs,
  activeTab,
  onTabChange,
  fullWidth = false,
}: {
  tabs: { key: TabKey; label: string; icon: string }[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  fullWidth?: boolean;
}) {
  return (
    <div className={`flex bg-slate-100 dark:bg-bg-surface-dark/50 p-1 rounded-xl ${fullWidth ? '' : 'w-fit'}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold transition-all
            ${fullWidth ? 'flex-1 text-xs' : 'px-4 text-sm'}
            ${activeTab === tab.key
              ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
            }`}
        >
          <MaterialIcon name={tab.icon} className={fullWidth ? 'text-sm' : 'text-base'} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TabContent({
  activeTab,
  service,
  serviceId,
  refreshKey,
  onTabChange,
  onServiceUpdate,
  onApiKeyRegenerated,
}: Pick<LogDetailViewProps, 'activeTab' | 'service' | 'serviceId' | 'refreshKey' | 'onTabChange' | 'onServiceUpdate' | 'onApiKeyRegenerated'>) {
  return (
    <>
      {activeTab === 'logs' && <ErrorLogTable serviceId={serviceId} refreshKey={refreshKey} />}
      {activeTab === 'requests' && (
        <RequestsTab
          serviceId={serviceId}
          onGoToSettings={() => onTabChange('settings')}
        />
      )}
      {activeTab === 'integration' && (
        <IntegrationPanel service={service} onApiKeyRegenerated={onApiKeyRegenerated} />
      )}
      {activeTab === 'settings' && (
        <LogServiceSettings service={service} onSuccess={onServiceUpdate} />
      )}
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
  const { t } = useTranslation(['logs', 'common']);
  return (
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
            onClick={onClose}
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
  );
}

function RevealedKeyModal({
  revealedKey,
  revealCountdown,
  onClose,
  onCopy,
}: {
  revealedKey: string;
  revealCountdown: number;
  onClose: () => void;
  onCopy: (key: string) => void;
}) {
  const { t } = useTranslation(['logs', 'common']);
  return (
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
            onClick={() => onCopy(revealedKey)}
            className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark"
            title={t('common.copyToClipboard')}
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
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {t('logServices.apiKey.revealConfirm')}
          {revealCountdown > 0 && ` (${revealCountdown}s)`}
        </button>
      </div>
    </div>
  );
}

// --- 데스크톱 레이아웃 ---

function DesktopLayout(props: LogDetailViewProps) {
  const { t } = useTranslation(['logs', 'common']);
  const {
    service, serviceId, refreshKey, isLive, lastUpdated, dateLocale,
    activeTab, isDeleteDialogOpen, isDeleting, revealedKey, revealCountdown,
    onTabChange, onLiveToggle, onRefresh, onDelete,
    onDeleteDialogOpen, onDeleteDialogClose,
    onServiceUpdate, onApiKeyRegenerated, onRevealedKeyClose, onCopyKey,
  } = props;

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'logs',        label: t('logServices.detail.tabs.logs'),        icon: 'article'                  },
    { key: 'requests',    label: t('apiRequests.tabs.requests'),           icon: 'http'                     },
    { key: 'integration', label: t('logServices.detail.tabs.integration'), icon: 'integration_instructions' },
    { key: 'settings',    label: t('logServices.detail.tabs.settings'),    icon: 'tune'                     },
  ];

  const openRename = () => { setRenameDraft(service.name); setIsRenameOpen(true); };

  const handleRename = async () => {
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === service.name) { setIsRenameOpen(false); return; }
    setIsRenaming(true);
    try {
      const updated = await api.updateService(service.id, { name: trimmed });
      onServiceUpdate(updated);
      setIsRenameOpen(false);
      toast.success(t('common.saved', { defaultValue: 'Saved' }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      {/* Breadcrumbs & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <Breadcrumbs items={[{ label: t('common.backToList'), href: '/logs' }]} />
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
              {t('common.refresh')}
            </div>
          </div>

          <div className="relative group">
            <button onClick={openRename} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-600 dark:text-text-secondary-dark">
              <MaterialIcon name="edit" className="text-lg" />
            </button>
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              {t('common.edit', { defaultValue: 'Edit' })}
            </div>
          </div>

          <div className="relative group">
            <button onClick={onDeleteDialogOpen} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500">
              <MaterialIcon name="delete" className="text-lg" />
            </button>
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              {t('common.delete', { defaultValue: 'Delete' })}
            </div>
          </div>
        </div>
      </div>

      <LogServiceIdentity service={service} onServiceUpdate={onServiceUpdate} />

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 scrollbar-hide">
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      <TabContent
        activeTab={activeTab}
        service={service}
        serviceId={serviceId}
        refreshKey={refreshKey}
        onTabChange={onTabChange}
        onServiceUpdate={onServiceUpdate}
        onApiKeyRegenerated={onApiKeyRegenerated}
      />

      {isDeleteDialogOpen && (
        <DeleteDialog service={service} isDeleting={isDeleting} onClose={onDeleteDialogClose} onDelete={onDelete} />
      )}

      {/* Rename Modal */}
      {isRenameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <MaterialIcon name="edit" className="text-xl text-primary" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('common.edit', { defaultValue: 'Edit' })}
              </h3>
            </div>
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenameOpen(false);
              }}
              autoFocus
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-ui-hover-dark text-sm text-slate-900 dark:text-white outline-none focus:border-primary dark:focus:border-primary transition-colors mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setIsRenameOpen(false)}
                disabled={isRenaming}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors disabled:opacity-50"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={handleRename}
                disabled={isRenaming || !renameDraft.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRenaming ? (
                  <MaterialIcon name="sync" className="text-lg animate-spin" />
                ) : (
                  t('common.save', { defaultValue: 'Save' })
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {revealedKey && (
        <RevealedKeyModal
          revealedKey={revealedKey}
          revealCountdown={revealCountdown}
          onClose={onRevealedKeyClose}
          onCopy={onCopyKey}
        />
      )}
    </>
  );
}

// --- 모바일 레이아웃 ---

function MobileLayout(props: LogDetailViewProps) {
  const { t } = useTranslation(['logs', 'common']);
  const navigate = useNavigate();
  const {
    service, serviceId, refreshKey, isLive,
    activeTab, isDeleteDialogOpen, isDeleting, revealedKey, revealCountdown,
    onTabChange, onLiveToggle, onRefresh, onDelete,
    onDeleteDialogOpen, onDeleteDialogClose,
    onServiceUpdate, onApiKeyRegenerated, onRevealedKeyClose, onCopyKey,
  } = props;

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'logs',        label: t('logServices.detail.tabs.logs'),        icon: 'article'                  },
    { key: 'requests',    label: t('apiRequests.tabs.requests'),           icon: 'http'                     },
    { key: 'integration', label: t('logServices.detail.tabs.integration'), icon: 'integration_instructions' },
    { key: 'settings',    label: t('logServices.detail.tabs.settings'),    icon: 'tune'                     },
  ];

  const handleRename = async () => {
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === service.name) { setIsRenameOpen(false); return; }
    setIsRenaming(true);
    try {
      const updated = await api.updateService(service.id, { name: trimmed });
      onServiceUpdate(updated);
      setIsRenameOpen(false);
      toast.success(t('common.saved', { defaultValue: 'Saved' }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRenaming(false);
    }
  };

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
            onClick={() => { setRenameDraft(service.name); setIsRenameOpen(true); }}
            className="p-2.5 rounded-lg bg-primary text-white active:scale-95 transition-transform cursor-pointer"
          >
            <MaterialIcon name="edit" className="text-lg" />
          </button>
          <button
            onClick={onDeleteDialogOpen}
            className="p-2.5 rounded-lg bg-red-500 text-white active:scale-95 transition-transform cursor-pointer"
          >
            <MaterialIcon name="delete" className="text-lg" />
          </button>
        </div>
      </div>

      <LogServiceIdentity service={service} onServiceUpdate={onServiceUpdate} />

      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} fullWidth />

      <TabContent
        activeTab={activeTab}
        service={service}
        serviceId={serviceId}
        refreshKey={refreshKey}
        onTabChange={onTabChange}
        onServiceUpdate={onServiceUpdate}
        onApiKeyRegenerated={onApiKeyRegenerated}
      />

      {isDeleteDialogOpen && (
        <DeleteDialog service={service} isDeleting={isDeleting} onClose={onDeleteDialogClose} onDelete={onDelete} />
      )}

      {revealedKey && (
        <RevealedKeyModal
          revealedKey={revealedKey}
          revealCountdown={revealCountdown}
          onClose={onRevealedKeyClose}
          onCopy={onCopyKey}
        />
      )}

      {/* Rename Modal */}
      {isRenameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <MaterialIcon name="edit" className="text-xl text-primary" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('common.edit', { defaultValue: 'Edit' })}
              </h3>
            </div>
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenameOpen(false);
              }}
              autoFocus
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-ui-hover-dark text-sm text-slate-900 dark:text-white outline-none focus:border-primary dark:focus:border-primary transition-colors mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setIsRenameOpen(false)}
                disabled={isRenaming}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors disabled:opacity-50"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={handleRename}
                disabled={isRenaming || !renameDraft.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRenaming ? (
                  <MaterialIcon name="sync" className="text-lg animate-spin" />
                ) : (
                  t('common.save', { defaultValue: 'Save' })
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 진입점 ---

export function LogDetailView(props: LogDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
