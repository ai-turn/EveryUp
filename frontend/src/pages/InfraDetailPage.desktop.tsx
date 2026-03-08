import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { MaterialIcon, Toggle } from '../components/common';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { InfraGauges, InfraTrends, ProcessTable, InfraForm, DeleteConfirmDialog } from '../features/infra';
import { useHost } from '../hooks/useData';
import { api } from '../services/api';
import { useSidePanel } from '../contexts/SidePanelContext';
import { infraStatusColorClasses } from '../design-tokens/colors';

interface InfraDetailDesktopProps {
  hostId: string;
}

export function InfraDetailDesktop({ hostId }: InfraDetailDesktopProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openPanel } = useSidePanel();
  const { data: host, refetch } = useHost(hostId);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);

  const name = host?.name || hostId;
  const ip = host?.ip || '';
  const cluster = host?.group || '';

  const hostStatusMap: Record<string, string> = {
    online: 'healthy',
    offline: 'critical',
    unknown: 'warning',
    error: 'error',
  };
  const status = hostStatusMap[host?.status || 'unknown'] || 'healthy';

  const sc = infraStatusColorClasses[status as keyof typeof infraStatusColorClasses] || infraStatusColorClasses.healthy;

  const handlePauseResume = async () => {
    if (!host) return;
    setIsPausing(true);
    try {
      if (host.isActive) {
        await api.pauseHost(host.id);
        toast.success(t('monitoring.toast.paused'));
      } else {
        await api.resumeHost(host.id);
        toast.success(t('monitoring.toast.resumed'));
      }
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('monitoring.toast.updateFailed'));
    } finally {
      setIsPausing(false);
    }
  };

  const handleDelete = async () => {
    if (!host) return;
    setIsDeleting(true);
    try {
      await api.deleteHost(host.id);
      toast.success(t('monitoring.toast.deleted'));
      navigate('/infra');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('monitoring.toast.deleteFailed'));
      setIsDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!host) return;
    openPanel(
      t('monitoring.editHost'),
      <InfraForm onSuccess={refetch} host={host} />
    );
  };

  const isLocal = host?.type === 'local';

  return (
    <>
      {/* Breadcrumbs */}
      <div className="flex flex-col gap-4 mb-6">
        <Breadcrumbs
          items={[
            { label: t('nav.monitoring'), href: '/infra' },
            { label: cluster || 'Local', href: '/infra' },
            { label: name },
          ]}
        />

        {/* Header */}
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-slate-900 dark:text-white text-2xl sm:text-4xl font-black tracking-tight">
                {name}
              </h1>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sc.bg} ${sc.text} text-xs font-bold uppercase tracking-wider`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
                </span>
                {t(`common.${status}`)}
              </span>
            </div>
            <p className="text-slate-500 dark:text-text-muted-dark text-base">
              {ip && `IP: ${ip}`}
              {host?.type === 'local' && ' (Local)'}
            </p>
          </div>

          {/* Error Banner */}
          {host?.status === 'error' && host.lastError && (
            <div className="w-full mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <MaterialIcon name="error_outline" className="text-lg text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400">{t('monitoring.error.lastError')}</p>
                  <p className="text-xs text-red-600 dark:text-red-500 truncate">{host.lastError}</p>
                </div>
              </div>
              <button
                onClick={handlePauseResume}
                disabled={isPausing}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
              >
                {t('monitoring.error.retryConnection')}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button className="flex items-center justify-center rounded-lg h-10 px-3 sm:px-4 bg-slate-100 dark:bg-bg-surface-dark border border-transparent dark:border-ui-border-dark text-slate-900 dark:text-white text-sm font-bold hover:bg-slate-200 dark:hover:bg-ui-hover-dark transition-colors gap-2">
              <MaterialIcon name="download" className="text-lg" />
              <span className="hidden sm:inline">{t('monitoring.exportReport')}</span>
            </button>
            {host && (
              <>
                {!isLocal && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-chart-surface rounded-lg">
                    <Toggle
                      checked={host.isActive}
                      onChange={handlePauseResume}
                    />
                    <span className="hidden sm:inline text-sm font-medium text-slate-700 dark:text-text-secondary-dark">
                      {host.isActive ? t('monitoring.active') : t('monitoring.paused')}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleEdit}
                  className="flex items-center justify-center rounded-lg h-10 px-3 sm:px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors gap-2 cursor-pointer active:scale-95"
                >
                  <MaterialIcon name="edit" className="text-lg" />
                  <span className="hidden sm:inline">{t('monitoring.editHost')}</span>
                </button>
                <button
                  onClick={() => {
                    if (isLocal) {
                      toast.error(t('monitoring.toast.cannotDeleteLocal'));
                      return;
                    }
                    setIsDeleteDialogOpen(true);
                  }}
                  disabled={isLocal}
                  className="flex items-center justify-center rounded-lg h-10 px-3 sm:px-4 bg-red-500 dark:bg-red-600 text-white text-sm font-bold hover:bg-red-600 dark:hover:bg-red-700 transition-colors gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <MaterialIcon name="delete" className="text-lg" />
                  <span className="hidden sm:inline">{t('monitoring.deleteHost')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Radial Gauges */}
      <InfraGauges hostId={hostId} />

      {/* Infra Trends */}
      <InfraTrends hostId={hostId} />

      {/* Process Table */}
      <ProcessTable hostId={hostId} />

      {/* Modals */}
      {host && (
        <DeleteConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDelete}
          hostName={host.name}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}
