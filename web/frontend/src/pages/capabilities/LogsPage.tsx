import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { Button, EmptyState, MaterialIcon, PageHeader, SearchInput } from '../../components/common';
import { DirectLogsSetupDialog } from '../../features/logs/components/DirectLogsSetupDialog';
import { LEVEL_STYLE } from '../../features/healthcheck/logLevelStyle';
import { CapabilityAgentSetup } from '../../features/services/components/CapabilityAgentSetup';
import { api, type AgentServiceFlat, type LogEntry, type ObservedService } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

export function LogsPage() {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [query, setQuery] = useState('');
  const [showDirectSetup, setShowDirectSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getLogs({ limit: 100 }),
      api.getAllAgentServicesFlat(),
      api.getObservedServices('logs'),
    ])
      .then(([logRows, agentRows, directRows]) => {
        if (!alive) return;
        setLogs(logRows ?? []);
        setAgentServices(agentRows ?? []);
        setDirectServices(directRows ?? []);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return logs;
    return logs.filter(log =>
      log.message.toLowerCase().includes(normalized)
      || log.serviceName?.toLowerCase().includes(normalized)
      || log.level.includes(normalized),
    );
  }, [logs, query]);

  const agentPaths = useMemo(() => new Map(
    agentServices.map(service => [`${service.agentId}:${service.name}`, service]),
  ), [agentServices]);
  const directPaths = useMemo(() => new Map(
    directServices.map(service => [service.id, service]),
  ), [directServices]);

  return (
    <div>
      <PageHeader title={t('로그')} subtitle={t('Agent 또는 직접 OpenTelemetry 연결에서 수집한 최신 로그입니다.')}>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <SearchInput
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('로그 검색')}
            aria-label={t('로그 검색')}
            wrapperClassName="w-full sm:w-72"
          />
          <Button onClick={() => setShowDirectSetup(true)}><MaterialIcon name="add" />{t('Logs 직접 추가')}</Button>
          <CapabilityAgentSetup capability="logs" buttonVariant="secondary" />
        </div>
      </PageHeader>

      {!loading && directServices.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-text-base">{t('직접 연결 서비스')}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{t('Agent 없이 OTLP Logs를 받는 Observed Service입니다.')}</p>
            </div>
            <span className="font-mono text-xs text-text-dim">{directServices.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {directServices.map(service => (
              <Link key={service.id} to={`/logs/${service.id}`} className="card-interactive rounded-xl border border-ui-border bg-bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-text-base">{service.name}</h3>
                    <p className="mt-1 truncate font-mono text-xs text-text-dim">{service.apiKeyMasked || '—'}</p>
                  </div>
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${service.isActive ? 'bg-status-healthy' : 'bg-status-error'}`}
                    role="img"
                    aria-label={service.isActive ? t('수집 가능') : t('중지됨')}
                  />
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  {service.lastSeenAt
                    ? `${t('마지막 수집')}: ${new Date(service.lastSeenAt).toLocaleString()}`
                    : t('아직 수집된 로그가 없습니다')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ) : error ? (
        <EmptyState icon="error_outline" title={t('로그를 불러오지 못했습니다')} description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="article"
          title={t(query ? '검색 결과가 없습니다' : '아직 수집된 로그가 없습니다')}
          description={t(query ? '검색어를 바꾸어 다시 시도해 보세요.' : 'Logs 직접 연결 또는 로그 수집 Agent를 추가하면 여기에 표시됩니다.')}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-ui-border bg-ui-hover-soft">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('레벨')}</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('메시지')}</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('서비스')}</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('시간')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-soft">
                {filtered.map(log => {
                  const agentService = log.agentId ? agentPaths.get(`${log.agentId}:${log.serviceName ?? ''}`) : undefined;
                  const directService = !log.agentId && log.serviceId ? directPaths.get(log.serviceId) : undefined;
                  return (
                    <tr key={log.id} className="hover:bg-ui-hover-soft">
                      <td className="px-4 py-3 align-top"><span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-bold ${LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info}`}>{log.level.toUpperCase()}</span></td>
                      <td className="max-w-xl px-4 py-3 align-top font-mono text-xs text-text-secondary">{log.message}</td>
                      <td className="px-4 py-3 align-top text-xs text-text-muted">
                        {agentService
                          ? <Link to={`/services/${agentService.agentId}/${encodeURIComponent(agentService.key)}?tab=logs`} className="hover:text-primary">{agentService.name}</Link>
                          : directService
                            ? <Link to={`/logs/${directService.id}`} className="hover:text-primary">{directService.name}</Link>
                            : log.serviceName || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-text-dim">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDirectSetup && (
        <DirectLogsSetupDialog
          onClose={() => setShowDirectSetup(false)}
          onCreated={service => navigate(`/logs/${service.id}`)}
        />
      )}
    </div>
  );
}
