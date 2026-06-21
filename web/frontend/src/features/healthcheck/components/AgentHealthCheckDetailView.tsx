import { useState } from 'react';
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
import { AgentServiceLogsTab } from './AgentServiceLogsTab';
import { AgentServiceRequestsTab } from './AgentServiceRequestsTab';
import { AgentServiceInfraTab } from './AgentServiceInfraTab';

export interface AgentHealthCheckDetailViewProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  isLive: boolean;
  onLiveToggle: (live: boolean) => void;
  onRefresh: () => void;
}

type DetailTab = 'health' | 'logs' | 'requests' | 'infra';

const TABS: { key: DetailTab; labelKo: string }[] = [
  { key: 'health',   labelKo: '헬스체크' },
  { key: 'logs',     labelKo: '로그' },
  { key: 'requests', labelKo: 'API' },
  { key: 'infra',    labelKo: '인프라' },
];

function TabBar({ active, onChange }: { active: DetailTab; onChange: (t: DetailTab) => void }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 dark:border-ui-border-dark mb-6">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-base font-semibold transition-colors border-b-2 -mb-px ${
            active === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
          }`}
        >
          {tab.labelKo}
        </button>
      ))}
    </div>
  );
}

function HealthContent({
  service, agentId, serviceKey, refreshKey,
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

function TabContent({ tab, service, agentId, serviceKey, refreshKey }: {
  tab: DetailTab;
} & Pick<AgentHealthCheckDetailViewProps, 'service' | 'agentId' | 'serviceKey' | 'refreshKey'>) {
  if (tab === 'logs')     return <AgentServiceLogsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />;
  if (tab === 'requests') return <AgentServiceRequestsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />;
  if (tab === 'infra')    return <AgentServiceInfraTab agentId={agentId} refreshKey={refreshKey} />;
  return <HealthContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />;
}

function DesktopLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const { service, agentId, serviceKey, refreshKey, isLive, onLiveToggle, onRefresh } = props;
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);
  const [activeTab, setActiveTab] = useState<DetailTab>('health');

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <Breadcrumbs items={[{ label: tc('common.backToList'), href: '/' }]} />
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
      <TabBar active={activeTab} onChange={setActiveTab} />
      <TabContent tab={activeTab} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </>
  );
}

function MobileLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, isLive, onLiveToggle, onRefresh } = props;
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);
  const [activeTab, setActiveTab] = useState<DetailTab>('health');

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
      <TabBar active={activeTab} onChange={setActiveTab} />
      <TabContent tab={activeTab} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </div>
  );
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
