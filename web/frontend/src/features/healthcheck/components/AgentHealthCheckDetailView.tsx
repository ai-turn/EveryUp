import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { MaterialIcon } from '../../../components/common';
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

function DesktopLayout(props: AgentHealthCheckDetailViewProps) {
  const { service, agentId, serviceKey, refreshKey, onRefresh } = props;

  return (
    <>
      {/* ver2: breadcrumb (project / service) + status badge, refresh on the right */}
      <div className="flex items-center gap-2.5 mb-6">
        <Link
          to={`/projects/${agentId}`}
          className="text-sm text-slate-500 dark:text-text-muted-dark hover:text-primary transition-colors shrink-0"
        >
          {service.agentName}
        </Link>
        <span className="text-slate-300 dark:text-text-dim-dark">/</span>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{service.name}</h1>
        <StatusBadge healthy={service.healthy} />
        <div className="ml-auto">
          <RefreshButton onRefresh={onRefresh} />
        </div>
      </div>
      <AgentServiceTabs
        key={serviceKey}
        service={service}
        agentId={agentId}
        serviceKey={serviceKey}
        refreshKey={refreshKey}
        showServiceName={false}
      />
    </>
  );
}

function MobileLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, onRefresh } = props;

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
        <RefreshButton onRefresh={onRefresh} />
      </div>
      <AgentServiceTabs key={serviceKey} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </div>
  );
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
