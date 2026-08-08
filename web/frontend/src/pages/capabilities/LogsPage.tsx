import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { EmptyState, PageHeader, SearchInput } from '../../components/common';
import { api, type AgentServiceFlat, type LogEntry } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { LEVEL_STYLE } from '../../features/healthcheck/logLevelStyle';
import { CapabilityAgentSetup } from '../../features/services/components/CapabilityAgentSetup';

export function LogsPage() {
  const { t } = useTranslate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [services, setServices] = useState<AgentServiceFlat[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getLogs({ limit: 100 }), api.getAllAgentServicesFlat()])
      .then(([logData, serviceData]) => {
        if (!alive) return;
        setLogs(logData ?? []);
        setServices(serviceData ?? []);
      })
      .catch((requestError) => { if (alive) setError(getErrorMessage(requestError)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return logs;
    return logs.filter((log) =>
      log.message.toLowerCase().includes(normalized)
      || log.serviceName?.toLowerCase().includes(normalized)
      || log.level.includes(normalized),
    );
  }, [logs, query]);

  const servicePaths = useMemo(() => new Map(
    services.map((service) => [`${service.agentId}:${service.name}`, service]),
  ), [services]);

  return (
    <div>
      <PageHeader title={t('로그')} subtitle={t('선택한 로그 수집 Agent와 OpenTelemetry 소스에서 수집한 최신 로그입니다.')}>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('로그 검색')}
            aria-label={t('로그 검색')}
            wrapperClassName="w-full sm:w-72"
          />
          <CapabilityAgentSetup capability="logs" />
        </div>
      </PageHeader>

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ) : error ? (
        <EmptyState icon="error_outline" title={t('로그를 불러오지 못했습니다')} description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="article"
          title={t(query ? '검색 결과가 없습니다' : '아직 수집된 로그가 없습니다')}
          description={t(query ? '검색어를 바꿔 다시 시도해 보세요.' : '로그 수집 Agent를 연결하면 여기에 표시됩니다.')}
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
                {filtered.map((log) => {
                  const service = log.agentId ? servicePaths.get(`${log.agentId}:${log.serviceName ?? ''}`) : undefined;
                  return <tr key={log.id} className="hover:bg-ui-hover-soft">
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-bold ${LEVEL_STYLE[log.level] ?? LEVEL_STYLE.info}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="max-w-xl px-4 py-3 align-top font-mono text-xs text-text-secondary">{log.message}</td>
                    <td className="px-4 py-3 align-top text-xs text-text-muted">
                      {service ? <Link to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=logs`} className="hover:text-primary">{service.name}</Link> : log.serviceName || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-text-dim">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
