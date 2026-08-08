import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { EmptyState, MaterialIcon, PageHeader, StatusBadge } from '../../components/common';
import { api, type ApiRequestStatusSummary, type ConnectedAgent } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { CapabilityAgentSetup } from '../../features/services/components/CapabilityAgentSetup';

interface AgentApiSummary {
  agent: ConnectedAgent;
  summary: ApiRequestStatusSummary;
}

function agentOnline(agent: ConnectedAgent) {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

export function ApiPage() {
  const { t } = useTranslate();
  const [rows, setRows] = useState<AgentApiSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.getAgents()
      .then(async (agents) => {
        const summaries = await Promise.all(agents.map(async (agent) => ({
          agent,
          summary: await api.getRequestStatusSummary(agent.id),
        })));
        if (alive) setRows(summaries);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <PageHeader title="API" subtitle={t('API 프로필 Agent의 요청 상태와 오류 추이를 확인합니다.')}>
        <CapabilityAgentSetup capability="api" />
      </PageHeader>
      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}
        </div>
      ) : error ? (
        <EmptyState icon="error_outline" title={t('API 데이터를 불러오지 못했습니다')} description={error} />
      ) : rows.length === 0 ? (
        <EmptyState icon="api" title={t('표시할 API 대상이 없습니다')} description={t('API Agent를 연결하면 관측 대상이 여기에 표시됩니다.')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ agent, summary }) => {
            const total = summary.count2xx + summary.count3xx + summary.count4xx + summary.count5xx + summary.countOther;
            const hasErrors = summary.count5xx > 0;
            return (
              <Link key={agent.id} to={`/agents/${agent.id}`} className="group rounded-xl border border-ui-border bg-bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-ui-hover-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <MaterialIcon name="api" className="text-lg text-primary" />
                    <h2 className="truncate text-base font-bold text-text-base">{agent.name}</h2>
                  </div>
                  <StatusBadge healthy={agentOnline(agent)} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div><p className="text-2xs text-text-dim">{t('요청')}</p><p className="font-mono text-lg font-bold text-text-base">{total.toLocaleString()}</p></div>
                  <div><p className="text-2xs text-text-dim">5xx</p><p className={`font-mono text-lg font-bold ${hasErrors ? 'text-status-error' : 'text-text-base'}`}>{summary.count5xx.toLocaleString()}</p></div>
                </div>
                {summary.top5xxPath ? <p className="mt-4 truncate font-mono text-xs text-text-muted">{summary.top5xxMethod} {summary.top5xxPath}</p> : <p className="mt-4 text-xs text-text-dim">{t('아직 오류 요청이 없습니다')}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
