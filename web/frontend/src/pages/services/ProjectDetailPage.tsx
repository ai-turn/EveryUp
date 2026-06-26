import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import { MaterialIcon } from '../../components/common';
import { api, type AgentServiceFlat, type ConnectedAgent } from '../../services/api';
import { AgentServiceCard } from '../../features/services/components/AgentServiceCard';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { getErrorMessage } from '../../utils/errors';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

export function ProjectDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslate();

  const [agent, setAgent] = useState<ConnectedAgent | null>(null);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);

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
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 rounded-xl bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
        ))}
      </div>
    );
  }

  // The project may exist without an agent row only for orphan services; derive a
  // display name from the first service in that case.
  const agentName = agent?.name ?? services[0]?.agentName ?? agentId ?? '';
  const online = agent ? agentOnline(agent) : true;
  const healthy = services.filter((s) => s.healthy).length;
  const allHealthy = healthy === services.length;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark hover:text-slate-800 dark:hover:text-white transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-base" />
        {t('프로젝트 목록')}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{agentName}</h1>
            {agent?.version && (
              <span className="text-xs text-slate-400 dark:text-text-dim-dark">v{agent.version}</span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-text-muted-dark">
            서비스 {services.length}개 · <span className={allHealthy ? '' : 'text-red-500 font-medium'}>{healthy}/{services.length} 정상</span>
          </p>
        </div>
        {agent && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setShowKey(true)}
              title="API 키 보기"
              className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <MaterialIcon name="key" className="text-base" />
            </button>
            <button
              onClick={handleDeleteAgent}
              title="프로젝트 비활성화"
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <MaterialIcon name="delete_outline" className="text-base" />
            </button>
          </div>
        )}
      </div>

      {/* Services */}
      {services.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon name="inventory_2" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark">
            {t('수집된 서비스가 없습니다')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <AgentServiceCard key={`${svc.agentId}/${svc.key}`} service={svc} onDelete={handleDeleteService} />
          ))}
        </div>
      )}

      {showKey && agent && (
        <ApiKeyModal
          agentId={agent.id}
          agentName={agent.name}
          onClose={() => setShowKey(false)}
          onRotated={load}
        />
      )}
    </div>
  );
}
