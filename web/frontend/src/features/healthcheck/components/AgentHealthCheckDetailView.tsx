import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, Toggle } from '../../../components/common';
import { Breadcrumbs } from '../../../components/layout/Breadcrumbs';
import { useSpinAction } from '../../../hooks/useSpinAction';
import { useIsMobile } from '../../../hooks/useMediaQuery';
import type { AgentServiceFlat } from '../../../services/api';
import { AgentServiceTabs } from './AgentServiceTabs';

export interface AgentHealthCheckDetailViewProps {
  service: AgentServiceFlat;
  agentId: string;
  serviceKey: string;
  refreshKey: number;
  isLive: boolean;
  onLiveToggle: (live: boolean) => void;
  onRefresh: () => void;
  onDelete: () => void;
}

function DesktopLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const { service, agentId, serviceKey, refreshKey, isLive, onLiveToggle, onRefresh, onDelete } = props;
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);

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
          <button
            onClick={onDelete}
            title="서비스 삭제"
            className="inline-flex items-center justify-center rounded-lg bg-slate-100 dark:bg-ui-hover-dark px-3 py-2 text-slate-500 dark:text-text-secondary-dark transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <MaterialIcon name="delete_outline" className="text-base" />
          </button>
        </div>
      </div>
      <AgentServiceTabs key={serviceKey} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </>
  );
}

function MobileLayout(props: AgentHealthCheckDetailViewProps) {
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { service, agentId, serviceKey, refreshKey, isLive, onLiveToggle, onRefresh, onDelete } = props;
  const { spinning, trigger: handleRefresh } = useSpinAction(onRefresh);

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
          <button
            onClick={onDelete}
            title="서비스 삭제"
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-secondary-dark active:scale-95 transition-transform hover:text-red-500"
          >
            <MaterialIcon name="delete_outline" className="text-lg" />
          </button>
        </div>
      </div>
      <AgentServiceTabs key={serviceKey} service={service} agentId={agentId} serviceKey={serviceKey} refreshKey={refreshKey} />
    </div>
  );
}

export function AgentHealthCheckDetailView(props: AgentHealthCheckDetailViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout {...props} /> : <DesktopLayout {...props} />;
}
