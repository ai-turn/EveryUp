import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Toggle } from '../../../components/common';
import { Breadcrumbs } from '../../../components/layout/Breadcrumbs';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import { useSpinAction } from '../../../hooks/useSpinAction';
import { useMonitoringGauges, useMonitoringProcesses, useSystemInfo } from '../../../hooks/useInfra';
import { InfraGauges } from './InfraGauges';
import { InfraTrends } from './InfraTrends';
import { ProcessTable } from './ProcessTable';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { infraStatusColorClasses } from '../../../design-tokens/colors';
import { processStatusConfig } from '../../../constants';
import type { Host } from '../../../services/api';
import type { SystemInfo } from '../../../services/api';

type MobileTab = 'overview' | 'trends' | 'processes';

export interface InfraDetailViewProps {
  host: Host | null;
  hostId: string;
  hostLoading: boolean;
  refreshKey: number;
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
  onRefresh: () => void;
  onDeleteDialogOpen: () => void;
  onDeleteDialogClose: () => void;
}

// --- 공통 헤더 (상태 배지 + 에러 배너) ---

function HostHeader({
  host, hostLoading, name, ip, cluster, status, isLocal, isPausing, onPauseResume, mobile, systemInfo,
}: Pick<InfraDetailViewProps, 'host' | 'hostLoading' | 'name' | 'ip' | 'cluster' | 'status' | 'isLocal' | 'isPausing' | 'onPauseResume'> & { mobile?: boolean; systemInfo?: SystemInfo | null }) {
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${sc.bg} border ${sc.border} ${sc.text} text-sm font-bold uppercase tracking-wider`}>
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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-slate-900 dark:text-white text-2xl sm:text-3xl font-bold tracking-tight">
              {name}
            </h1>
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${sc.bg} border ${sc.border}`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sc.dot} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${sc.dot}`} />
              </span>
              <span className={`${sc.text} text-sm font-bold uppercase tracking-wider`}>
                {t(`common.${status}`)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {host?.type && (
              <MetaChip icon={host.type === 'local' ? 'computer' : 'cloud'} labelKey="연결" value={host.type === 'local' ? '로컬' : 'SSH 원격'} />
            )}
            {ip && (
              <MetaChip icon="lan" labelKey="IP" value={`${ip}${host?.type === 'local' ? ' (Local)' : ''}`} />
            )}
            {cluster && (
              <MetaChip icon="account_tree" labelKey="그룹" value={cluster} />
            )}
            {systemInfo?.os && (
              <MetaChip icon="desktop_windows" labelKey="OS" value={systemInfo.os} />
            )}
            {systemInfo?.kernel && (
              <MetaChip icon="memory" labelKey="커널" value={systemInfo.kernel} />
            )}
            {!!systemInfo?.uptime && (
              <MetaChip icon="schedule" labelKey="업타임" value={formatUptime(systemInfo.uptime)} />
            )}
            {systemInfo?.hostname && (
              <MetaChip icon="dns" labelKey="호스트명" value={systemInfo.hostname} />
            )}
          </div>
        </>
      )}

      {host?.status === 'error' && host.lastError && (
        mobile ? (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon name="error_outline" className="text-sm text-red-500" />
              <p className="text-sm font-bold text-red-700 dark:text-red-400">{t('infra.error.lastError')}</p>
            </div>
            <p className="text-sm text-red-600 dark:text-red-500 truncate">{host.lastError}</p>
          </div>
        ) : (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MaterialIcon name="error_outline" className="text-lg text-red-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-red-700 dark:text-red-400">{t('infra.error.lastError')}</p>
                <p className="text-sm text-red-600 dark:text-red-500 truncate">{host.lastError}</p>
              </div>
            </div>
            <button
              onClick={onPauseResume}
              disabled={isPausing}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50"
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
    host, hostId, hostLoading, refreshKey, status, name, ip, cluster, isLocal, isPausing, isDeleting,
    isDeleteDialogOpen, onPauseResume, onDelete, onEdit, onRefresh, onDeleteDialogOpen, onDeleteDialogClose,
  } = props;
  const { data: systemInfo } = useSystemInfo(hostId, refreshKey);
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);

  return (
    <>
      <div className="mb-6">
        <Breadcrumbs items={[{ label: t('common.backToList'), href: '/infra' }]} />
      </div>

      <main className="min-w-0">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <HostHeader
              host={host} hostLoading={hostLoading} name={name} ip={ip} cluster={cluster}
              status={status} isLocal={isLocal} isPausing={isPausing} onPauseResume={onPauseResume}
              systemInfo={systemInfo}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 dark:bg-ui-hover-dark px-3 py-2 text-sm font-bold text-slate-600 dark:text-text-secondary-dark transition-colors hover:bg-slate-200 dark:hover:bg-ui-active-dark"
            >
              <MaterialIcon name="refresh" className={`text-base ${spinning ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>

            {/* 재연결 — critical/error 상태일 때만 표시 */}
            {host?.status === 'error' && !isLocal && (
              <button
                type="button"
                onClick={onPauseResume}
                disabled={isPausing}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                <MaterialIcon name="refresh" className="text-base" />
                {t('infra.error.retryConnection')}
              </button>
            )}

            {/* 일시정지 / 재개 */}
            {host && !isLocal && (
              <div className={`flex items-center gap-2 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-3 py-2 ${isPausing ? 'pointer-events-none opacity-60' : ''}`}>
                <Toggle checked={host.isActive} onChange={onPauseResume} />
              </div>
            )}

            <button
              type="button"
              onClick={onEdit}
              disabled={!host}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              <MaterialIcon name="edit" className="text-base" />
              {t('common.edit')}
            </button>
            <button
              type="button"
              onClick={onDeleteDialogOpen}
              disabled={!host || isLocal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MaterialIcon name="delete" className="text-base" />
              {t('common.delete')}
            </button>
          </div>
        </div>

        <InfraGauges hostId={hostId} refreshKey={refreshKey} />
        <InfraTrends hostId={hostId} refreshKey={refreshKey} />
        <ProcessTable hostId={hostId} refreshKey={refreshKey} />
      </main>

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

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function MetaChip({ icon, labelKey, value, accent }: { icon: string; labelKey: string; value: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border ${
        accent
          ? 'bg-primary/10 border-primary/20'
          : 'bg-white dark:bg-bg-surface-dark border-slate-200 dark:border-ui-border-dark'
      }`}
    >
      <MaterialIcon name={icon} className={`text-base shrink-0 ${accent ? 'text-primary' : 'text-slate-500 dark:text-text-muted-dark'}`} />
      <span className="font-semibold text-slate-500 dark:text-text-muted-dark">{labelKey}:</span>
      <span className={`font-bold ${accent ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>{value}</span>
    </span>
  );
}

// --- 모바일 레이아웃 ---

function MobileLayout(props: InfraDetailViewProps) {
  const { t } = useTranslation(['infra', 'common']);
  const navigate = useNavigate();
  const {
    host, hostId, hostLoading, refreshKey, status, name, ip, cluster, isLocal, isDeleting,
    isDeleteDialogOpen, onPauseResume, onDelete, onEdit, onRefresh, onDeleteDialogOpen, onDeleteDialogClose,
    isPausing,
  } = props;

  const { data: gauges, loading: gaugesLoading } = useMonitoringGauges(hostId, refreshKey);
  const { data: processes, loading: processesLoading } = useMonitoringProcesses(hostId, refreshKey);
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);
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
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-secondary-dark active:scale-95 transition-transform cursor-pointer"
          >
            <MaterialIcon name="refresh" className={`text-lg ${spinning ? 'animate-spin' : ''}`} />
          </button>
          {host && !isLocal && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
              <Toggle checked={host.isActive} onChange={onPauseResume} />
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
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-text-muted-dark'
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-lg" />
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
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      {gauge.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-chart-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                      style={{ width: `${gauge.percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-1.5">
                    {gauge.subtitle}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'trends' && <InfraTrends hostId={hostId} refreshKey={refreshKey} />}

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
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-text-muted-dark">
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
