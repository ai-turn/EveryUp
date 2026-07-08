import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import { MaterialIcon } from '../../components/common';
import { useSpinAction } from '../../hooks/useSpinAction';
import {
  api,
  type AgentServiceFlat, type ConnectedAgent, type AgentIncident,
  type AgentEvent, type ServiceUptimeDay, type ApiRequestStatBucket,
} from '../../services/api';
import { ApiKeyModal } from '../../features/services/components/ApiKeyModal';
import { InstrumentationOverrideModal } from '../../features/services/components/InstrumentationOverrideModal';
import { AgentServiceRequestTrends } from '../../features/healthcheck/components/AgentServiceRequestTrends';
import { AgentCheckHistoryBar } from '../../features/healthcheck/components/AgentCheckHistoryBar';
import { getErrorMessage } from '../../utils/errors';

function agentOnline(agent: ConnectedAgent): boolean {
  return Date.now() - new Date(agent.lastSeenAt).getTime() < 2 * 60 * 1000;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}

function formatIncidentTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// One KPI stat card for the project dashboard header row.
function KpiCard({ label, value, unit, sub, tone }: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: 'danger' | 'warn';
}) {
  const valueColor =
    tone === 'danger' ? 'text-red-500'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl px-4 py-3.5">
      <div className="text-xs text-slate-500 dark:text-text-muted-dark">{label}</div>
      <div className={`text-xl font-bold mt-1 font-mono ${valueColor}`}>
        {value}
        {unit && <span className="text-xs font-medium text-slate-400 dark:text-text-dim-dark ml-0.5">{unit}</span>}
      </div>
      {sub && <div className="text-2xs text-slate-400 dark:text-text-dim-dark mt-0.5">{sub}</div>}
    </div>
  );
}

// One service in the project overview grid. Current health/latency/status come
// straight from the flat snapshot (no extra fetch). Click → full service detail.
function ServiceCard({ service, onOpen, onDelete }: {
  service: AgentServiceFlat;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslate();
  return (
    <div
      onClick={onOpen}
      className="group bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:translate-y-0 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-0.5 ${service.healthy ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          <div className="min-w-0">
            <h3 className="font-semibold text-base text-slate-900 dark:text-white truncate leading-tight">{service.name}</h3>
            <span className="text-xs text-slate-400 dark:text-text-dim-dark truncate block">{service.runtime ?? service.checkType}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!service.healthy && (
            <span className="text-2xs font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded">{t('장애')}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="서비스 삭제"
            className="p-1 rounded-md text-slate-300 dark:text-text-dim-dark opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <MaterialIcon name="delete_outline" className="text-base" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="min-w-0">
          <div className="text-2xs text-slate-400 dark:text-text-dim-dark">{t('응답시간')}</div>
          <div className="font-mono font-semibold text-slate-800 dark:text-white truncate">{service.lastLatency ?? '—'}</div>
        </div>
        <div className="min-w-0">
          <div className="text-2xs text-slate-400 dark:text-text-dim-dark">{t('상태')}</div>
          <div className={`font-mono font-semibold ${service.healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {service.lastStatus ?? '—'}
          </div>
        </div>
      </div>

      {!service.healthy && service.lastError && (
        <p className="text-xs text-red-500 dark:text-red-400 truncate -mt-1">{service.lastError}</p>
      )}

      <div className="border-t border-slate-100 dark:border-ui-border-dark" />
      <div className="flex items-center justify-end gap-0.5 text-xs text-primary font-medium">
        {t('상세 보기')}
        <MaterialIcon name="chevron_right" className="text-sm" />
      </div>
    </div>
  );
}

// Project overview: aggregate header + service health grid. Individual service
// detail lives at /services/:agentId/:key (linked from the sidebar tree too).
export function ProjectDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslate();

  const [agent, setAgent] = useState<ConnectedAgent | null>(null);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [showInstrumentation, setShowInstrumentation] = useState(false);

  // Dashboard aggregates — non-critical, each fails independent of the main load.
  const [incidents, setIncidents] = useState<AgentIncident[]>([]);
  const [uptimeDays, setUptimeDays] = useState<ServiceUptimeDay[]>([]);
  const [reqBuckets, setReqBuckets] = useState<ApiRequestStatBucket[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);

  const load = useCallback(async () => {
    if (!agentId) return;
    api.getAgentIncidents(agentId).then((d) => setIncidents(d ?? [])).catch(() => {});
    api.getAgentUptime(agentId, 30).then((d) => setUptimeDays(d ?? [])).catch(() => {});
    api.getAgentRequestStats(agentId, {
      from: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      bucketMins: 60,
    }).then((d) => setReqBuckets(d ?? [])).catch(() => {});
    api.getAgentEvents(agentId, 8).then((d) => setEvents(d ?? [])).catch(() => {});
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

  const { spinning, trigger: handleRefresh } = useSpinAction(load);

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

  // Dashboard KPI derivations (ver2 redesign)
  const activeIncidents = incidents.filter((i) => i.active);
  const banner = activeIncidents[0];
  const uptimeTotals = uptimeDays.reduce(
    (acc, d) => ({ healthy: acc.healthy + d.healthyChecks, total: acc.total + d.totalChecks }),
    { healthy: 0, total: 0 },
  );
  const uptime30 = uptimeTotals.total > 0 ? (uptimeTotals.healthy / uptimeTotals.total) * 100 : null;
  const req24h = reqBuckets.reduce((s, b) => s + b.count, 0);
  const latestTimed = [...reqBuckets].reverse().find((b) => b.timed > 0);
  const p95 = latestTimed ? Math.round(latestTimed.p95) : null;

  return (
    <div className="space-y-5">
      {/* Back — mobile only; desktop navigates via the always-present sidebar */}
      <button
        onClick={() => navigate('/')}
        className="lg:hidden flex items-center gap-1 text-sm text-slate-500 dark:text-text-muted-dark hover:text-slate-800 dark:hover:text-white transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-base" />
        {t('프로젝트 목록')}
      </button>

      {/* Project header + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{agentName}</h1>
            {agent?.version && <span className="text-xs text-slate-400 dark:text-text-dim-dark">v{agent.version}</span>}
          </div>
          <p className="text-sm text-slate-500 dark:text-text-muted-dark flex items-center gap-1.5">
            <span>{t('서비스')} {services.length}{t('개')}</span>
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
      </div>

      {/* Active incident banner */}
      {banner && (
        <button
          onClick={() => navigate(`/services/${agentId}/${encodeURIComponent(banner.key)}`)}
          className="w-full flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/15 px-4 py-3 text-left hover:border-red-300 dark:hover:border-red-800 transition-colors"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {t('진행 중 장애')} — {banner.serviceName}
          </span>
          <span className="text-xs text-slate-500 dark:text-text-muted-dark shrink-0">
            {formatDuration(banner.durationSec)} {t('경과')}
            {activeIncidents.length > 1 && ` · +${activeIncidents.length - 1}`}
          </span>
          <span className="ml-auto text-xs font-semibold text-primary shrink-0 flex items-center">
            {t('서비스 열기')}
            <MaterialIcon name="chevron_right" className="text-sm" />
          </span>
        </button>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t('가동률 · 30일')}
          value={uptime30 !== null ? uptime30.toFixed(2) : '—'}
          unit={uptime30 !== null ? '%' : undefined}
        />
        <KpiCard
          label={t('활성 장애')}
          value={String(activeIncidents.length)}
          tone={activeIncidents.length > 0 ? 'danger' : undefined}
          sub={activeIncidents.length > 0 ? activeIncidents.map((i) => i.serviceName).join(', ') : undefined}
        />
        <KpiCard
          label={t('요청 · 24시간')}
          value={req24h > 0 ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(req24h) : '—'}
        />
        <KpiCard
          label={t('p95 · 최근')}
          value={p95 !== null ? String(p95) : '—'}
          unit={p95 !== null ? 'ms' : undefined}
          tone={p95 !== null && p95 > 500 ? 'warn' : undefined}
        />
      </div>

      {/* Service health grid */}
      {services.length === 0 ? (
        <div className="py-16 text-center">
          <MaterialIcon name="inventory_2" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-2" />
          <p className="text-sm text-slate-400 dark:text-text-muted-dark">{t('수집된 서비스가 없습니다')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <ServiceCard
              key={s.key}
              service={s}
              onOpen={() => navigate(`/services/${agentId}/${encodeURIComponent(s.key)}`)}
              onDelete={() => handleDeleteService(s)}
            />
          ))}
        </div>
      )}

      {/* Project-level Requests aggregate (rolls up all services; self-hides when no request data) */}
      {services.length > 0 && agentId && (
        <AgentServiceRequestTrends agentId={agentId} />
      )}

      {/* 90-day uptime calendar + incidents / timeline */}
      {services.length > 0 && agentId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2">
            <AgentCheckHistoryBar agentId={agentId} className="" />
          </div>
          <div className="flex flex-col gap-4">
            {/* Incident history */}
            <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('장애 이력 · 30일')}</h3>
              {incidents.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-text-dim-dark py-4 text-center">{t('최근 30일간 장애가 없습니다')}</p>
              ) : (
                <div className="space-y-2">
                  {incidents.slice(0, 5).map((inc, i) => (
                    <button
                      key={`${inc.key}-${inc.startedAt}-${i}`}
                      onClick={() => navigate(`/services/${agentId}/${encodeURIComponent(inc.key)}`)}
                      className={`w-full flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        inc.active
                          ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/15 hover:border-red-300'
                          : 'border-slate-200 dark:border-ui-border-dark hover:border-slate-300 dark:hover:border-ui-active-dark'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${inc.active ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-800 dark:text-white truncate">{inc.serviceName}</span>
                        <span className="block text-2xs text-slate-400 dark:text-text-dim-dark mt-0.5">
                          {formatIncidentTime(inc.startedAt)} {t('시작')} · {formatDuration(inc.durationSec)}
                        </span>
                      </span>
                      <span className={`text-2xs font-bold shrink-0 ${inc.active ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {inc.active ? t('진행중') : t('해소')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Event timeline */}
            <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('타임라인')}</h3>
              {events.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-text-dim-dark py-4 text-center">{t('최근 이벤트가 없습니다')}</p>
              ) : (
                <div className="space-y-0.5">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-baseline gap-2.5 py-1.5 border-b border-slate-50 dark:border-ui-border-dark/50 last:border-0">
                      <span className="text-2xs font-mono text-slate-400 dark:text-text-dim-dark w-10 shrink-0">
                        {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 translate-y-px ${
                        e.type === 'alert_sent' ? 'bg-red-500'
                        : e.type === 'status_change' ? 'bg-amber-500'
                        : 'bg-slate-300 dark:bg-ui-active-dark'
                      }`} />
                      <span className="text-xs text-slate-600 dark:text-text-muted-dark min-w-0 truncate" title={e.message}>
                        {e.message || e.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
