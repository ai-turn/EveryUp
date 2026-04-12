import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Toggle } from '../../../components/common';
import { Breadcrumbs } from '../../../components/layout/Breadcrumbs';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useMonitoringGauges, useMonitoringProcesses } from '../../../hooks/useInfra';
import { InfraGauges } from './InfraGauges';
import { InfraTrends } from './InfraTrends';
import { ProcessTable } from './ProcessTable';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { infraStatusColorClasses } from '../../../design-tokens/colors';
import { processStatusConfig } from '../../../constants';
import type { Host } from '../../../services/api';

type MobileTab = 'overview' | 'trends' | 'processes';

export interface InfraDetailViewProps {
  host: Host | null;
  hostId: string;
  hostLoading: boolean;
  status: string;
  name: string;
  ip: string;
  cluster: string;
  isLocal: boolean;
  isPausing: boolean;
  isDeleting: boolean;
  isDeleteDialogOpen: boolean;
  onPauseResume: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDeleteDialogOpen: () => void;
  onDeleteDialogClose: () => void;
}

// --- 공통 헤더 (상태 배지 + 에러 배너) ---

function HostHeader({
  host, hostLoading, name, ip, cluster, status, isLocal, isPausing, onPauseResume, mobile,
}: Pick<InfraDetailViewProps, 'host' | 'hostLoading' | 'name' | 'ip' | 'cluster' | 'status' | 'isLocal' | 'isPausing' | 'onPauseResume'> & { mobile?: boolean }) {
  const { t } = useTranslation(['infra', 'common']);
  const sc = infraStatusColorClasses[status as keyof typeof infraStatusColorClasses] || infraStatusColorClasses.healthy;

  if (hostLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className={`${mobile ? 'h-7 w-40' : 'h-10 w-56'} bg-slate-200 dark:bg-ui-hover-dark rounded-lg`} />
        <div className={`${mobile ? 'h-4 w-28' : 'h-4 w-36'} bg-slate-100 dark:bg-ui-active-dark rounded`} />
      </div>
    );
  }

  return (
    <>
      {mobile ? (
        <>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">{name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text} text-xs font-bold uppercase tracking-wider`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
              </span>
              {t(`common.${status}`)}
            </span>
            {(cluster || ip) && (
              <p className="text-sm text-slate-500 dark:text-text-muted-dark">
                {cluster && <span className="mr-2">{cluster}</span>}
                {ip && `IP: ${ip}`}
                {isLocal && ' (Local)'}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-1">
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
          <p className="text-slate-500 dark:text-text-muted-dark text-base flex items-center gap-2">
            {cluster && <span>{cluster}</span>}
            {ip && <span>IP: {ip}{host?.type === 'local' ? ' (Local)' : ''}</span>}
          </p>
        </>
      )}

      {host?.status === 'error' && host.lastError && (
        mobile ? (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon name="error_outline" className="text-sm text-red-500" />
              <p className="text-xs font-bold text-red-700 dark:text-red-400">{t('infra.error.lastError')}</p>
            </div>
            <p className="text-xs text-red-600 dark:text-red-500 truncate">{host.lastError}</p>
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MaterialIcon name="error_outline" className="text-lg text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-red-700 dark:text-red-400">{t('infra.error.lastError')}</p>
                <p className="text-xs text-red-600 dark:text-red-500 truncate">{host.lastError}</p>
              </div>
            </div>
            <button
              onClick={onPauseResume}
              disabled={isPausing}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
            >
              {t('infra.error.retryConnection')}
            </button>
          </div>
        )
      )}
    </>
  );
}

// --- 데스크톱 레이아웃 ---

function DesktopLayout(props: InfraDetailViewProps) {
  const { t } = useTranslation(['infra', 'common']);
  const {
    host, hostId, hostLoading, status, name, ip, cluster, isLocal, isPausing, isDeleting,
    isDeleteDialogOpen, onPauseResume, onDelete, onEdit, onDeleteDialogOpen, onDeleteDialogClose,
  } = props;

  return (
    <>
      {/* Breadcrumbs & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <Breadcrumbs items={[{ label: t('common.backToList'), href: '/infra' }]} />
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-chart-surface rounded-lg p-1">
          <div className="relative group">
            <button className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-600 dark:text-text-secondary-dark">
              <MaterialIcon name="download" className="text-lg" />
            </button>
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              {t('infra.exportReport')}
            </div>
          </div>

          {host && !isLocal && (
            <>
              <div className="w-px h-5 bg-slate-300 dark:bg-ui-active-dark mx-0.5" />
              <div className="flex items-center gap-2 px-2 py-1">
                <Toggle checked={host.isActive} onChange={onPauseResume} />
                <span className="hidden sm:inline text-xs text-slate-400 dark:text-text-muted-dark">
                  {host.isActive ? t('infra.active') : t('infra.paused')}
                </span>
              </div>
            </>
          )}

          {host && (
            <>
              <div className="w-px h-5 bg-slate-300 dark:bg-ui-active-dark mx-0.5" />
              <div className="relative group">
                <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-600 dark:text-text-secondary-dark">
                  <MaterialIcon name="edit" className="text-lg" />
                </button>
                <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                  {t('infra.editHost')}
                </div>
              </div>
              <div className="relative group">
                <button
                  onClick={onDeleteDialogOpen}
                  disabled={isLocal}
                  className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <MaterialIcon name="delete" className="text-lg" />
                </button>
                <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 dark:bg-slate-700 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                  {t('infra.deleteHost')}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <HostHeader
          host={host} hostLoading={hostLoading} name={name} ip={ip} cluster={cluster}
          status={status} isLocal={isLocal} isPausing={isPausing} onPauseResume={onPauseResume}
        />
      </div>

      <InfraGauges hostId={hostId} />
      <InfraTrends hostId={hostId} />
      <ProcessTable hostId={hostId} />

      {host && (
        <DeleteConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={onDeleteDialogClose}
          onConfirm={onDelete}
          hostName={host.name}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
}

// --- 모바일 레이아웃 ---

function MobileLayout(props: InfraDetailViewProps) {
  const { t } = useTranslation(['infra', 'common']);
  const navigate = useNavigate();
  const {
    host, hostId, hostLoading, status, name, ip, cluster, isLocal, isDeleting,
    isDeleteDialogOpen, onPauseResume, onDelete, onEdit, onDeleteDialogOpen, onDeleteDialogClose,
    isPausing,
  } = props;

  const { data: gauges, loading: gaugesLoading } = useMonitoringGauges(hostId);
  const { data: processes, loading: processesLoading } = useMonitoringProcesses(hostId);
  const [activeTab, setActiveTab] = useState<MobileTab>('overview');

  const tabs: { key: MobileTab; label: string; icon: string }[] = [
    { key: 'overview', label: t('common.overview', { defaultValue: 'Overview' }), icon: 'dashboard' },
    { key: 'trends', label: t('infra.trends.title'), icon: 'trending_up' },
    { key: 'processes', label: t('infra.processes.title'), icon: 'list' },
  ];

  return (
    <div className="space-y-4">
      {/* Nav Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/infra')}
          className="flex items-center gap-1 text-slate-500 dark:text-text-muted-dark active:opacity-60 transition-opacity cursor-pointer"
        >
          <MaterialIcon name="arrow_back" className="text-lg" />
          <span className="text-sm font-medium">{t('common.backToList')}</span>
        </button>
        <div className="flex items-center gap-2">
          {host && !isLocal && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-chart-surface rounded-lg">
              <Toggle checked={host.isActive} onChange={onPauseResume} />
              <span className="text-xs font-medium text-slate-700 dark:text-text-secondary-dark">
                {host.isActive ? t('infra.active') : t('infra.paused')}
              </span>
            </div>
          )}
          {host && (
            <>
              <button
                onClick={onEdit}
                className="p-2.5 rounded-lg bg-primary text-white active:scale-95 transition-transform cursor-pointer"
              >
                <MaterialIcon name="edit" className="text-lg" />
              </button>
              {!isLocal && (
                <button
                  onClick={onDeleteDialogOpen}
                  className="p-2.5 rounded-lg bg-red-500 text-white active:scale-95 transition-transform cursor-pointer"
                >
                  <MaterialIcon name="delete" className="text-lg" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <HostHeader
          host={host} hostLoading={hostLoading} name={name} ip={ip} cluster={cluster}
          status={status} isLocal={isLocal} isPausing={isPausing} onPauseResume={onPauseResume}
          mobile
        />
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
        <div className="space-y-3">
          {gaugesLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
            ))
          ) : (
            (gauges || []).map(gauge => {
              const pct = gauge.percentage;
              const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary';
              return (
                <div
                  key={gauge.label}
                  className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-text-base-dark uppercase tracking-wide">
                      {gauge.label}
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {gauge.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-chart-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${gauge.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-1.5">
                    {gauge.subtitle}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'trends' && <InfraTrends hostId={hostId} />}

      {activeTab === 'processes' && (
        <div className="space-y-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white px-1">
            {t('infra.processes.title')}
          </h3>
          {processesLoading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
            ))
          ) : !processes || processes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-text-muted-dark text-sm">
              {t('infra.processes.empty', { defaultValue: 'No processes found' })}
            </div>
          ) : (
            processes.map((proc, idx) => {
              const statusClass = processStatusConfig[proc.status.toUpperCase() as keyof typeof processStatusConfig] || processStatusConfig.RUNNING;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">
                      {proc.name}
                    </span>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${statusClass}`}>
                      {proc.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-text-muted-dark">
                    <span>PID {proc.pid}</span>
                    <span className="font-mono">CPU {proc.cpu}%</span>
                    <span className="font-mono">MEM {proc.memory}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {host && (
        <DeleteConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={onDeleteDialogClose}
          onConfirm={onDelete}
          hostName={host.name}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}

// --- 진입점: 내부적으로 모바일 감지 후 레이아웃 분기 ---

export function InfraDetailView(props: InfraDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
