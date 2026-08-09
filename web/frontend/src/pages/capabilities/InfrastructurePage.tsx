import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { EmptyState, MaterialIcon, PageHeader, StatusBadge } from '../../components/common';
import { api, type ConnectedAgent, type SystemInfo } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { CapabilityAgentSetup } from '../../features/services/components/CapabilityAgentSetup';

interface InfrastructureRow {
  agent: ConnectedAgent;
  info?: SystemInfo;
}

function agentOnline(agent: ConnectedAgent) {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

export function InfrastructurePage() {
  const { t } = useTranslate();
  const [rows, setRows] = useState<InfrastructureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getAgents()
      .then(async (agents) => {
        const result = await Promise.all(agents.map(async (agent) => {
          try {
            return { agent, info: await api.getSystemInfo(agent.id) };
          } catch {
            return { agent };
          }
        }));
        if (alive) setRows(result);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <PageHeader title={t('인프라')} subtitle={t('인프라 프로필로 연결한 Agent 호스트의 CPU, 메모리, 디스크 상태를 확인합니다.')}>
        <CapabilityAgentSetup capability="infrastructure" />
      </PageHeader>
      {loading ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div> : error ? (
        <EmptyState icon="error_outline" title={t('인프라를 불러오지 못했습니다')} description={error} />
      ) : rows.length === 0 ? (
        <EmptyState icon="memory" title={t('표시할 인프라가 없습니다')} description={t('인프라 Agent를 연결하면 호스트 리소스가 여기에 표시됩니다.')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ agent, info }) => <Link key={agent.id} to={`/agents/${agent.id}`} className="card-interactive rounded-xl border border-ui-border bg-bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5"><MaterialIcon name="memory" className="text-lg text-primary" /><div className="min-w-0"><h2 className="truncate text-base font-bold text-text-base">{agent.name}</h2><p className="truncate text-xs text-text-muted">{info?.hostname || t('호스트 정보 대기 중')}</p></div></div>
              <StatusBadge healthy={agentOnline(agent)} />
            </div>
            {info ? <div className="mt-5 grid grid-cols-3 gap-3">
              {[['CPU', info.cpu.usage], [t('메모리'), info.memory.usage], [t('디스크'), info.disk.usage]].map(([label, value]) => <div key={String(label)}><p className="text-2xs text-text-dim">{label}</p><p className="font-mono text-base font-bold text-text-base">{Number(value).toFixed(1)}%</p></div>)}
            </div> : <p className="mt-5 text-sm text-text-dim">{t('아직 수집된 호스트 메트릭이 없습니다')}</p>}
          </Link>)}
        </div>
      )}
    </div>
  );
}
