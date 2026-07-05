import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import { MaterialIcon } from '../../components/common';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useSpinAction } from '../../hooks/useSpinAction';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { AgentServiceTabs } from '../../features/healthcheck/components/AgentServiceTabs';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { getErrorMessage } from '../../utils/errors';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

// One row in the service sidebar / mobile chip rail.
// Desktop rows reveal a delete action on hover (onDelete); the mobile chip omits it.
function ServiceItem({ service, active, onSelect, onDelete, mobile }: {
  service: AgentServiceFlat;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  mobile?: boolean;
}) {
  const { t } = useTranslate();

  const dot = <span className={`h-2 w-2 rounded-full shrink-0 ${service.healthy ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />;
  const downBadge = !service.healthy && (
    <span className="shrink-0 text-2xs font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded">{t('장애')}</span>
  );

  if (mobile) {
    return (
      <button
        onClick={onSelect}
        className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${active
          ? 'bg-primary/10 border-primary/40 text-primary'
          : 'bg-white dark:bg-bg-surface-dark border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark'}`}
      >
        {dot}
        <span className="truncate">{service.name}</span>
        {downBadge}
      </button>
    );
  }

  return (
    <div className={`group flex items-center gap-1 rounded-lg transition-colors ${active
      ? 'bg-primary/10'
      : 'hover:bg-slate-100 dark:hover:bg-ui-hover-dark'}`}
    >
      <button
        onClick={onSelect}
        className={`flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-left ${active
          ? 'text-primary font-semibold'
          : 'text-slate-600 dark:text-text-muted-dark'}`}
      >
        {dot}
        <span className="truncate flex-1">{service.name}</span>
        {downBadge}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          title="서비스 삭제"
          className="shrink-0 mr-1 p-1.5 rounded-md text-slate-300 dark:text-text-dim-dark opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <MaterialIcon name="delete_outline" className="text-lg" />
        </button>
      )}
    </div>
  );
}

export function ProjectDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslate();
  const isMobile = useIsMobile();

  const [agent, setAgent] = useState<ConnectedAgent | null>(null);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showKey, setShowKey] = useState(false);
  const [showInstrumentation, setShowInstrumentation] = useState(false);

  const load = useCallback(async () => {
    if (!agentId) return;
    try {
      const [agents, all] = await Promise.all([api.getAgents(), api.getAllAgentServicesFlat()]);
      setAgent(agents.find((a) => a.id === agentId) ?? null);
      setServices((all ?? []).filter((s) => s.agentId === agentId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    load();
    const id = setInterval(() => { load(); setRefreshKey((k) => k + 1); }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const { spinning, trigger: handleRefresh } = useSpinAction(() => { load(); setRefreshKey((k) => k + 1); });

  const handleDeleteAgent = async () => {
    if (!agentId) return;
    if (!confirm(`'${agent?.name ?? agentId}' 프로젝트를 비활성화하시겠습니까?\n에이전트 연결이 차단되며 수집 데이터는 보존됩니다.`)) return;
    try {
      await api.deleteAgent(agentId);
      toast.success('프로젝트가 비활성화됐습니다');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteService = async (svc: AgentServiceFlat) => {
    if (!confirm(`'${svc.name}' 서비스를 목록에서 삭제하시겠습니까?\n에이전트가 이 대상을 계속 수집 중이면 다음 동기화 때 다시 나타날 수 있습니다.`)) return;
    try {
      await api.deleteAgentService(svc.agentId, svc.key);
      toast.success('서비스가 삭제됐습니다');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-500 dark:text-text-muted-dark">
        <MaterialIcon name="sync" className="text-2xl animate-spin" />
      </div>
    );
  }

  const agentName = agent?.name ?? services[0]?.agentName ?? agentId ?? '';
  const online = agent ? agentOnline(agent) : true;
  const healthy = services.filter((s) => s.healthy).length;
  const allHealthy = healthy === services.length;

  const selectedKey = searchParams.get('service') ?? services[0]?.key;
  const selected = services.find((s) => s.key === selectedKey) ?? services[0];
  const selectService = (key: string) => setSearchParams({ service: key }, { replace: true });

  // Project-level actions, reused in the desktop sidebar header and the mobile/empty top header.
  const actionButtons = (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={handleRefresh}
        title="새로고침"
        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ui-hover-dark transition-colors"
      >
        <MaterialIcon name="refresh" className={`text-xl ${spinning ? 'animate-spin' : ''}`} />
      </button>
      {agent && (
        <>
          <button
            onClick={() => setShowKey(true)}
            title="API 키 보기"
            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <MaterialIcon name="key" className="text-xl" />
          </button>
          <button
            onClick={() => setShowInstrumentation(true)}
            title="OTel 계측 설정 (헤더·바디)"
            className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <MaterialIcon name="integration_instructions" className="text-xl" />
          </button>
          <button
            onClick={handleDeleteAgent}
            title="프로젝트 비활성화"
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <MaterialIcon name="delete_outline" className="text-xl" />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark hover:text-slate-800 dark:hover:text-white transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-base" />
        {t('프로젝트 목록')}
      </button>

      {/* Project header — full width on mobile / empty state; desktop renders it inside the sidebar */}
      {(isMobile || services.length === 0 || !selected) && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{agentName}</h1>
              {agent?.version && <span className="text-xs text-slate-400 dark:text-text-dim-dark">v{agent.version}</span>}
            </div>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark flex items-center gap-1.5">
              <span>서비스 {services.length}개</span>
              <span className="text-slate-300 dark:text-text-dim-dark">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{healthy} {t('정상')}</span>
              {!allHealthy && (
                <>
                  <span className="text-slate-300 dark:text-text-dim-dark">·</span>
                  <span className="text-red-500 font-medium">{services.length - healthy} {t('장애')}</span>
                </>
              )}
            </p>
          </div>
          {actionButtons}
        </div>
      )}

      {services.length === 0 || !selected ? (
        <div className="py-16 text-center">
          <MaterialIcon name="inventory_2" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark">{t('수집된 서비스가 없습니다')}</p>
        </div>
      ) : isMobile ? (
        /* Mobile: horizontal service rail + tabs below */
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {services.map((s) => (
              <ServiceItem key={s.key} service={s} active={s.key === selected.key} onSelect={() => selectService(s.key)} mobile />
            ))}
          </div>
          <AgentServiceTabs key={selected.key} service={selected} agentId={agentId!} serviceKey={selected.key} refreshKey={refreshKey} showServiceName={false} />
        </div>
      ) : (
        /* Desktop: sidebar (project header + services) + detail */
        <div className="flex gap-6">
          <aside className="w-64 shrink-0">
            {/* Project identity + actions */}
            <div className="px-1 pb-3 mb-3 border-b border-slate-200 dark:border-ui-border-dark">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <h1 className="text-base font-bold text-slate-900 dark:text-white truncate">{agentName}</h1>
                </div>
                {actionButtons}
              </div>
              <p className="mt-1.5 px-0.5 text-xs text-slate-500 dark:text-text-muted-dark flex items-center gap-1 flex-wrap">
                {agent?.version && <span className="text-slate-400 dark:text-text-dim-dark">v{agent.version}</span>}
                {agent?.version && <span className="text-slate-300 dark:text-text-dim-dark">·</span>}
                <span>서비스 {services.length}개</span>
                <span className="text-slate-300 dark:text-text-dim-dark">·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{healthy} {t('정상')}</span>
                {!allHealthy && (
                  <>
                    <span className="text-slate-300 dark:text-text-dim-dark">·</span>
                    <span className="text-red-500 font-medium">{services.length - healthy} {t('장애')}</span>
                  </>
                )}
              </p>
            </div>
            {/* Services */}
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-text-dim-dark">{t('서비스')}</p>
            <div className="space-y-1">
              {services.map((s) => (
                <ServiceItem key={s.key} service={s} active={s.key === selected.key} onSelect={() => selectService(s.key)} onDelete={() => handleDeleteService(s)} />
              ))}
            </div>
          </aside>
          <div className="flex-1 min-w-0">
            <AgentServiceTabs key={selected.key} service={selected} agentId={agentId!} serviceKey={selected.key} refreshKey={refreshKey} showServiceName={false} />
          </div>
        </div>
      )}

      {showKey && agent && (
        <ApiKeyModal agentId={agent.id} agentName={agent.name} onClose={() => setShowKey(false)} onRotated={load} />
      )}
      {showInstrumentation && agent && (
        <InstrumentationOverrideModal agentId={agent.id} onClose={() => setShowInstrumentation(false)} />
      )}
    </div>
  );
}
