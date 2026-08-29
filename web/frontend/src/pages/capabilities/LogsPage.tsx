import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { Button, EmptyState, MaterialIcon, PageHeader, Pagination, SearchInput, Select } from '../../components/common';
import { DirectLogsSetupDialog } from '../../features/logs/components/DirectLogsSetupDialog';
import { LEVEL_STYLE } from '../../features/healthcheck/logLevelStyle';
import { CapabilityAgentSetup } from '../../features/services/components/CapabilityAgentSetup';
import { api, type AgentServiceFlat, type LogEntry, type ObservedService } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

const PAGE_SIZE = 25;
// Sample the card sections read from — wider than one page so the source
// directory does not shrink to whatever the table happens to be showing.
const OVERVIEW_SAMPLE = 100;

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function LogsPage() {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  // Unfiltered snapshot the card sections read from — they are a directory of
  // sources, so they must not shrink when the table is filtered.
  const [overview, setOverview] = useState<LogEntry[]>([]);
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showDirectSetup, setShowDirectSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getAllAgentServicesFlat(),
      api.getObservedServices('logs'),
      api.getLogs({ limit: OVERVIEW_SAMPLE }),
    ])
      .then(([agentRows, directRows, sample]) => {
        if (!alive) return;
        setAgentServices(agentRows ?? []);
        setDirectServices(directRows ?? []);
        setOverview(sample?.data ?? []);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); });
    return () => { alive = false; };
  }, []);

  // Filters go to the server: the client only ever holds LOG_LIMIT rows, so
  // filtering here would search the loaded page and call the rest non-existent.
  useEffect(() => {
    let alive = true;
    api.getLogs({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      search: search || undefined,
      serviceName: serviceFilter || undefined,
    })
      .then(result => {
        if (!alive) return;
        setError(null);
        setLogs(result?.data ?? []);
        setTotal(result?.total ?? 0);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [search, serviceFilter, page]);

  // Registered sources plus whatever the unfiltered snapshot actually carried —
  // a log's serviceName comes off the OTLP resource and need not match a
  // registered service. Never derived from the filtered result: a filter whose
  // choices depend on its own output can't be un-narrowed.
  const serviceNames = useMemo(() => [...new Set([
    ...agentServices.map(service => service.name),
    ...directServices.map(service => service.name),
    ...overview.map(log => log.serviceName).filter(Boolean) as string[],
  ])].sort(), [agentServices, directServices, overview]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const agentPaths = useMemo(() => new Map(
    agentServices.map(service => [`${service.agentId}:${service.name}`, service]),
  ), [agentServices]);
  const directPaths = useMemo(() => new Map(
    directServices.map(service => [service.id, service]),
  ), [directServices]);

  // Docker-collected services get the same card grid as the direct ones — derived from
  // the logs already in hand, so the section costs no extra request.
  const agentCards = useMemo(() => {
    const byKey = new Map<string, { service: AgentServiceFlat; total: number; error: number; warn: number }>();
    for (const log of overview) {
      if (!log.agentId) continue;
      const key = `${log.agentId}:${log.serviceName ?? ''}`;
      const service = agentPaths.get(key);
      if (!service) continue;
      const row = byKey.get(key) ?? { service, total: 0, error: 0, warn: 0 };
      row.total += 1;
      if (log.level === 'error') row.error += 1;
      if (log.level === 'warn') row.warn += 1;
      byKey.set(key, row);
    }
    return [...byKey.values()].sort((a, b) => b.error - a.error || b.total - a.total);
  }, [overview, agentPaths]);

  return (
    <div>
      <PageHeader title={t('로그')} subtitle={t('Docker 수집기 또는 직접 OpenTelemetry 연결에서 수집한 최신 로그입니다.')}>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <Button onClick={() => setShowDirectSetup(true)}><MaterialIcon name="add" />{t('Logs 직접 추가')}</Button>
          <CapabilityAgentSetup capability="logs" buttonVariant="secondary" />
        </div>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={serviceFilter}
          onChange={event => { setServiceFilter(event.target.value); setPage(1); }}
          aria-label={t('서비스 필터')}
          className="w-full sm:w-48"
        >
          <option value="">{t('전체 서비스')}</option>
          {serviceNames.map(name => <option key={name} value={name}>{name}</option>)}
        </Select>
        <form onSubmit={event => { event.preventDefault(); setSearch(inputValue); setPage(1); }} className="flex w-full gap-1.5 sm:w-72">
          <SearchInput
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            placeholder={t('메시지 검색 후 Enter')}
            aria-label={t('로그 검색')}
            wrapperClassName="flex-1"
          />
          {search && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(''); setInputValue(''); setPage(1); }} aria-label={t('검색어 지우기')}>
              <MaterialIcon name="close" />
            </Button>
          )}
        </form>
      </div>

      {!loading && directServices.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-text-base">{t('직접 연결 서비스')}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{t('OTLP Logs를 직접 받는 Observed Service입니다.')}</p>
            </div>
            <span className="font-mono text-xs text-text-dim">{directServices.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {directServices.map(service => (
              <Link key={service.id} to={`/logs/${service.id}`} className="card-interactive rounded-xl border border-ui-border bg-bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-sm font-bold text-text-base">{service.name}</h3>
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${service.isActive ? 'bg-status-healthy' : 'bg-status-error'}`}
                    role="img"
                    aria-label={service.isActive ? t('수집 가능') : t('중지됨')}
                  />
                </div>
                <p className="mt-3 text-xs text-text-secondary">
                  {service.lastSeenAt
                    ? `${t('마지막 수집')}: ${new Date(service.lastSeenAt).toLocaleString()}`
                    : t('아직 수집된 로그가 없습니다')}
                </p>
                <p className="mt-1 truncate font-mono text-2xs text-text-dim">{service.apiKeyMasked || '—'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && agentCards.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-text-base">{t('Docker 서비스')}</h2>
              <p className="mt-0.5 text-xs text-text-muted">{t('EveryUp Docker 수집기가 전달한 서비스입니다.')}</p>
            </div>
            <span className="font-mono text-xs text-text-dim">{agentCards.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {agentCards.map(({ service, total, error, warn }) => (
              <Link
                key={`${service.agentId}:${service.key}`}
                to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=logs`}
                className="card-interactive rounded-xl border border-ui-border bg-bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-sm font-bold text-text-base">{service.name}</h3>
                  <span className="shrink-0 text-xs text-text-muted">{service.agentName}</span>
                </div>
                <p className="mt-3 text-xs text-text-secondary">
                  {t('최근 {total}건 · ERROR {error} · WARN {warn}', { total, error, warn })}
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
      ) : logs.length === 0 ? (
        <EmptyState
          icon="article"
          title={t(search || serviceFilter ? '검색 결과가 없습니다' : '아직 수집된 로그가 없습니다')}
          description={t(search || serviceFilter ? '검색어나 서비스 필터를 바꾸어 다시 시도해 보세요.' : 'Logs를 직접 연결하거나 Docker 환경에서 로그 수집을 활성화하면 여기에 표시됩니다.')}
        />
      ) : (
        <>
          <p className="mb-2 text-xs text-text-dim">
            {t('총 {total}건 중 {start}–{end}', {
              total: total.toLocaleString(),
              start: ((page - 1) * PAGE_SIZE + 1).toLocaleString(),
              end: Math.min(page * PAGE_SIZE, total).toLocaleString(),
            })}
          </p>
          <div className="overflow-hidden rounded-xl border border-ui-border bg-bg-surface">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-ui-border bg-ui-hover-soft">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('시간')}</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('레벨')}</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('서비스')}</th>
                    <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t('메시지')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-soft">
                  {logs.map(log => {
                    const agentService = log.agentId ? agentPaths.get(`${log.agentId}:${log.serviceName ?? ''}`) : undefined;
                    const directService = !log.agentId && log.serviceId ? directPaths.get(log.serviceId) : undefined;
                    const serviceHref = agentService
                      ? `/services/${agentService.agentId}/${encodeURIComponent(agentService.key)}?tab=logs`
                      : directService ? `/logs/${directService.id}` : undefined;
                    return (
                      <tr key={log.id} className="hover:bg-ui-hover-soft">
                        <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-text-dim">{formatTime(log.createdAt)}</td>
                        <td className="px-4 py-3 align-top"><span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-bold ${LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info}`}>{log.level.toUpperCase()}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                            <MaterialIcon
                              name={log.agentId ? 'deployed_code' : 'sensors'}
                              className="text-sm text-text-dim"
                            />
                            {serviceHref
                              ? <Link to={serviceHref} className="hover:text-primary">{log.serviceName}</Link>
                              : log.serviceName || '—'}
                          </span>
                        </td>
                        <td className="max-w-xl px-4 py-3 align-top font-mono text-xs text-text-secondary">{log.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end border-t border-ui-border bg-ui-hover-soft/60 px-4 py-2.5">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onChange={setPage}
                  previousLabel={t('이전')}
                  nextLabel={t('다음')}
                />
              </div>
            )}
          </div>
        </>
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
