import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon, TimeRangePicker, type GlobalTimeRange } from '../../../components/common';
import { useSpinAction } from '../../../hooks/useSpinAction';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentServiceTabs } from './AgentServiceTabs';

export interface AgentHealthCheckDetailViewProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  onRefresh: () => void;
}

// Internal: layouts receive the shared chart time range from the wrapper below.
interface LayoutProps extends AgentHealthCheckDetailViewProps {
  range: GlobalTimeRange;
  onRangeChange: (r: GlobalTimeRange) => void;
}

function StatusBadge({ healthy }: { healthy: boolean }) {
  const { t } = useTranslate();
  return (
    <span
      className={`text-2xs font-bold px-1.5 py-0.5 rounded border ${
        healthy
          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20'
      }`}
    >
      {healthy ? t('정상') : t('장애')}
    </span>
  );
}

// Container uptime from an ISO start time; null when absent or the zero stamp.
function formatUptime(startedAt?: string): string | null {
  if (!startedAt) return null;
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${mins}분`;
}

// Container provenance line (image · restarts · uptime). Non-container services
// have no image → renders nothing. A restart count ≥3 is highlighted as a
// possible crash/restart loop.
function ContainerMeta({ service }: { service: AgentServiceFlat }) {
  if (!service.image) return null;
  const uptime = formatUptime(service.startedAt);
  const restarts = service.restartCount ?? 0;
  return (
    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 dark:text-text-dim-dark min-w-0">
      <span className="font-mono truncate">{service.image}</span>
      {restarts > 0 && (
        <>
          <span className="text-slate-300 dark:text-text-dim-dark shrink-0">·</span>
          <span className={`shrink-0 ${restarts >= 3 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
            재시작 {restarts}회
          </span>
        </>
      )}
      {uptime && (
        <>
          <span className="text-slate-300 dark:text-text-dim-dark shrink-0">·</span>
          <span className="shrink-0">업타임 {uptime}</span>
        </>
      )}
    </div>
  );
}

function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);
  return (
    <button
      onClick={handleRefresh}
      title="새로고침"
      className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ui-hover-dark transition-colors"
    >
      <MaterialIcon name="refresh" className={`text-lg ${spinning ? 'animate-spin' : ''}`} />
    </button>
  );
}

function DesktopLayout(props: LayoutProps) {
  const { service, agentId, serviceKey, refreshKey, onRefresh, range, onRangeChange } = props;

  return (
    <>
      {/* ver2: breadcrumb (project / service) + status badge, range + refresh on the right */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <Link
            to={`/projects/${agentId}`}
            className="text-sm text-slate-500 dark:text-text-muted-dark hover:text-primary transition-colors shrink-0"
          >
            {service.agentName}
          </Link>
          <span className="text-slate-300 dark:text-text-dim-dark">/</span>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{service.name}</h1>
          <StatusBadge healthy={service.healthy} />
          <div className="ml-auto flex items-center gap-2">
            <TimeRangePicker value={range} onChange={onRangeChange} />
            <RefreshButton onRefresh={onRefresh} />
          </div>
        </div>
        <ContainerMeta service={service} />
      </div>
      <AgentServiceTabs
        key={serviceKey}
        service={service}
        agentId={agentId}
        serviceKey={serviceKey}
        refreshKey={refreshKey}
        range={range}
        showServiceName={false}
      />
    </>
  );
}

function MobileLayout(props: LayoutProps) {
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, onRefresh, range, onRangeChange } = props;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-slate-500 dark:text-text-muted-dark active:opacity-60 transition-opacity cursor-pointer"
        >
          <MaterialIcon name="arrow_back" className="text-lg" />
          <span className="text-sm font-medium">{tc('common.backToList')}</span>
        </button>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={range} onChange={onRangeChange} />
          <RefreshButton onRefresh={onRefresh} />
        </div>
      </div>
      <ContainerMeta service={service} />
      <AgentServiceTabs key={serviceKey} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />
    </div>
  );
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  // Shared chart range for all tabs; survives service switches (Tabs remount on key).
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const layoutProps: LayoutProps = { ...props, range, onRangeChange: setRange };
  return isMobile ? <MobileLayout {...layoutProps} /> : <DesktopLayout {...layoutProps} />;
}
