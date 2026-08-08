import { useState } from 'react';
import { type GlobalTimeRange } from '../../../components/common';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentIdentity } from './AgentIdentity';
import { AgentRealtimeMetrics } from './AgentRealtimeMetrics';
import { AgentCheckHistoryBar } from './AgentCheckHistoryBar';
import { AgentResponseTimeChart } from './AgentResponseTimeChart';
import { AgentFailureHistory } from './AgentFailureHistory';
import { AgentServiceLogsTab } from './AgentServiceLogsTab';
import { AgentServiceRequestsTab } from './AgentServiceRequestsTab';
import { AgentServiceMetricsTab } from './AgentServiceMetricsTab';
import { AgentServiceInfraTab } from './AgentServiceInfraTab';
import { ServiceIncidentBanner } from './ServiceIncidentBanner';

export interface ServiceTabsProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  /** Shared chart time range picked in the page header. */
  range: GlobalTimeRange;
  /** Hide the service name + status badge in the health tab (e.g. when a sidebar already shows them). */
  showServiceName?: boolean;
}

export type DetailTab = 'health' | 'logs' | 'requests' | 'metrics' | 'infra';

const TABS: { key: DetailTab; labelKo: string }[] = [
  { key: 'health',   labelKo: '헬스체크' },
  { key: 'logs',     labelKo: '로그' },
  { key: 'requests', labelKo: 'API' },
  { key: 'metrics',  labelKo: '메트릭' },
  { key: 'infra',    labelKo: '인프라' },
];

function TabBar({ active, onChange }: { active: DetailTab; onChange: (t: DetailTab) => void }) {
  return (
    <div className="flex gap-1 border-b border-ui-border mb-6">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            active === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          {tab.labelKo}
        </button>
      ))}
    </div>
  );
}

function HealthContent({ service, agentId, serviceKey, refreshKey, range, showServiceName = true }: ServiceTabsProps) {
  return (
    <>
      <AgentIdentity service={service} showName={showServiceName} />
      <AgentRealtimeMetrics agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      <AgentCheckHistoryBar agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
      <AgentResponseTimeChart agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />
      <AgentFailureHistory agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </>
  );
}

function TabContent({ tab, service, agentId, serviceKey, refreshKey, range, showServiceName }: { tab: DetailTab } & ServiceTabsProps) {
  if (tab === 'logs')     return <AgentServiceLogsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'requests') return <AgentServiceRequestsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} runtime={service.runtime} />;
  if (tab === 'metrics')  return <AgentServiceMetricsTab agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} />;
  if (tab === 'infra')    return <AgentServiceInfraTab agentId={agentId} refreshKey={refreshKey} range={range} />;
  return <HealthContent service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} range={range} showServiceName={showServiceName} />;
}

// Tab bar + content for a single agent service. Reused by the full-page service
// detail and the project master-detail view. Resets to the health tab when the
// selected service changes (key={serviceKey} at the call site).
export function AgentServiceTabs({ initialTab = 'health', ...props }: ServiceTabsProps & { initialTab?: DetailTab }) {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);
  return (
    <>
      <ServiceIncidentBanner service={props.service} onInvestigate={() => setActiveTab('logs')} />
      <TabBar active={activeTab} onChange={setActiveTab} />
      <TabContent tab={activeTab} {...props} />
    </>
  );
}
