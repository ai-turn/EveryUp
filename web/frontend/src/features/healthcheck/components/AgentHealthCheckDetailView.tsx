import { useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Toggle } from '../../../components/common';
import { Breadcrumbs } from '../../../components/layout/Breadcrumbs';
import { useSpinAction } from '../../../hooks/useSpinAction';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentIdentity } from './AgentIdentity';
import { AgentRealtimeMetrics } from './AgentRealtimeMetrics';
import { AgentCheckHistoryBar } from './AgentCheckHistoryBar';
import { AgentResponseTimeChart } from './AgentResponseTimeChart';
import { AgentFailureHistory } from './AgentFailureHistory';

export interface AgentHealthCheckDetailViewProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  isLive: boolean;
  onLiveToggle: (live: boolean) => void;
  onRefresh: () => void;
}

function ServiceContent({
  service,
  agentId,
  serviceKey,
  refreshKey,
}: Pick<AgentHealthCheckDetailViewProps, 'service' | 'agentId' | 'serviceKey' | 'refreshKey'>) {
  const { t } = useTranslate();
  return (
    <>
      <AgentIdentity service={service} />
      <AgentRealtimeMetrics agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      <AgentCheckHistoryBar agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      <AgentResponseTimeChart agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />

      <div className="flex items-center gap-2 mt-2 mb-4">
        <MaterialIcon name="report" className="text-base text-slate-400 dark:text-text-dim-dark" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-text-dim-dark">
          {t('장애')}
        </h2>
        <div className="flex-1 border-t border-slate-200 dark:border-ui-border-dark" />
      </div>
      <AgentFailureHistory agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </>
  );
}

function DesktopLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const { service, agentId, serviceKey, refreshKey, isLive, onLiveToggle, onRefresh } = props;
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <Breadcrumbs items={[{ label: tc('common.backToList'), href: '/healthcheck' }]} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-3 py-2">
            <Toggle checked={isLive} onChange={onLiveToggle} />
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 dark:bg-ui-hover-dark px-3 py-2 text-sm font-bold text-slate-600 dark:text-text-secondary-dark transition-colors hover:bg-slate-200 dark:hover:bg-ui-active-dark"
          >
            <MaterialIcon name="refresh" className={`text-base ${spinning ? 'animate-spin' : ''}`} />
            {tc('common.refresh')}
          </button>
        </div>
      </div>
      <ServiceContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </>
  );
}

function MobileLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, isLive, onLiveToggle, onRefresh } = props;
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/healthcheck')}
          className="flex items-center gap-1 text-slate-500 dark:text-text-muted-dark active:opacity-60 transition-opacity cursor-pointer"
        >
          <MaterialIcon name="arrow_back" className="text-lg" />
          <span className="text-sm font-medium">{tc('common.backToList')}</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
            <Toggle checked={isLive} onChange={onLiveToggle} />
          </div>
          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-secondary-dark active:scale-95 transition-transform"
          >
            <MaterialIcon name="refresh" className={`text-lg ${spinning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <ServiceContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </div>
  );
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
