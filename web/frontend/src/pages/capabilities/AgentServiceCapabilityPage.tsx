import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import {
  Button, ConfirmDialog, EmptyState, MaterialIcon, PageHeader, SearchInput, StatusBadge,
} from '../../components/common';
import { UptimeMonitorDialog } from '../../features/uptime/components/UptimeMonitorDialog';
import { UptimeMonitorStatusBadge } from '../../features/uptime/components/UptimeMonitorStatusBadge';
import { api, type AgentServiceFlat, type UptimeMonitor, type UptimeMonitorInput } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ))}
    </div>
  );
}


export function AgentServiceCapabilityPage() {
  const { t } = useTranslate();
  const [agentServices, setAgentServices] = useState<AgentServiceFlat[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UptimeMonitor | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<UptimeMonitor | null>(null);
  const [processingDelete, setProcessingDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [services, configuredMonitors] = await Promise.all([
        api.getAllAgentServicesFlat(),
        api.getUptimeMonitors(),
      ]);
      setAgentServices(services ?? []);
      setMonitors(configuredMonitors ?? []);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAgentServices = useMemo(() => agentServices.filter((service) => !normalizedQuery
    || service.name.toLowerCase().includes(normalizedQuery)
    || service.agentName.toLowerCase().includes(normalizedQuery)
    || service.endpoint.toLowerCase().includes(normalizedQuery)), [agentServices, normalizedQuery]);
  const filteredMonitors = useMemo(() => monitors.filter((monitor) => !normalizedQuery
    || monitor.name.toLowerCase().includes(normalizedQuery)
    || monitor.url.toLowerCase().includes(normalizedQuery)), [monitors, normalizedQuery]);

  const saveMonitor = async (input: UptimeMonitorInput) => {
    if (editing) await api.updateUptimeMonitor(editing.id, { ...input, isActive: editing.isActive });
    else await api.createUptimeMonitor(input);
    await load();
  };

  const setActive = async (monitor: UptimeMonitor) => {
    try {
      await api.updateUptimeMonitor(monitor.id, {
        name: monitor.name, type: monitor.type, url: monitor.type === 'http' ? monitor.url : undefined,
        host: monitor.type === 'tcp' ? monitor.url : undefined, port: monitor.port, method: monitor.method,
        expectedStatus: monitor.expectedStatus, timeout: monitor.timeout, interval: monitor.interval,
        isActive: !monitor.isActive,
      });
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteMonitor = async () => {
    if (!deleting) return;
    setProcessingDelete(true);
    try {
      await api.deleteUptimeMonitor(deleting.id);
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setProcessingDelete(false);
    }
  };

  const empty = filteredAgentServices.length === 0 && filteredMonitors.length === 0;

  return (
    <div>
      <PageHeader title={t('업타임')} subtitle={t('Agent가 발견한 서비스와 직접 추가한 업타임 모니터를 확인합니다.')}>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('서비스 또는 대상 검색')} aria-label={t('서비스 또는 대상 검색')} wrapperClassName="w-full sm:w-72" />
          <Button onClick={() => setEditing(null)}><MaterialIcon name="add" />{t('업타임 추가')}</Button>
        </div>
      </PageHeader>

      {loading ? <ServiceListSkeleton /> : error ? (
        <EmptyState icon="error_outline" title={t('대상을 불러오지 못했습니다')} description={error} />
      ) : empty ? (
        <EmptyState icon="monitor_heart" title={t(normalizedQuery ? '검색 결과가 없습니다' : '표시할 업타임 대상이 없습니다')} description={t(normalizedQuery ? '검색어를 바꿔 다시 시도해 보세요.' : 'Agent를 연결하거나 업타임 모니터를 직접 추가해 보세요.')} />
      ) : (
        <div className="space-y-8">
          {filteredMonitors.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2"><MaterialIcon name="public" className="text-lg text-primary" /><h2 className="text-base font-bold text-text-base">{t('직접 추가한 업타임')}</h2></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredMonitors.map((monitor) => (
                  <article key={monitor.id} className="flex min-h-36 flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><h3 className="truncate text-base font-bold text-text-base">{monitor.name}</h3><p className="mt-1 text-xs text-text-muted">{t('Agent 없이 설정한 HTTP/TCP 모니터')}</p></div>
                      <UptimeMonitorStatusBadge monitor={monitor} />
                    </div>
                    <p className="truncate font-mono text-xs text-text-dim">{monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 text-xs text-text-muted"><span>{monitor.type.toUpperCase()} · {monitor.interval}{t('초')}</span><span>{monitor.isActive ? t('활성') : t('일시정지')}</span></div>
                    <div className="flex gap-2 border-t border-ui-border pt-3">
                      <Link to={`/uptime/${monitor.id}`} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-ui-border bg-bg-surface px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-ui-hover">
                        {t('상세 보기')}<MaterialIcon name="arrow_forward" className="text-sm" />
                      </Link>
                      <Button variant="secondary" size="sm" onClick={() => void setActive(monitor)}>{t(monitor.isActive ? '일시정지' : '재개')}</Button>
                      <Button variant="ghost" size="sm" aria-label={t('업타임 수정')} onClick={() => setEditing(monitor)}><MaterialIcon name="edit" /></Button>
                      <Button variant="ghost" size="sm" aria-label={t('업타임 삭제')} onClick={() => setDeleting(monitor)}><MaterialIcon name="delete" className="text-status-error" /></Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {filteredAgentServices.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2"><MaterialIcon name="smart_toy" className="text-lg text-primary" /><h2 className="text-base font-bold text-text-base">{t('Agent 발견 서비스')}</h2></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredAgentServices.map((service) => (
                  <Link key={`${service.agentId}:${service.key}`} to={`/services/${service.agentId}/${encodeURIComponent(service.key)}?tab=health`} className="group flex min-h-36 flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-ui-hover-soft">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-bold text-text-base">{service.name}</h3><p className="mt-1 truncate text-xs text-text-muted">{service.agentName}</p></div><StatusBadge healthy={service.healthy} /></div>
                    <p className="truncate font-mono text-xs text-text-dim">{service.endpoint || service.key}</p>
                    <span className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary">{t('상세 보기')}<MaterialIcon name="arrow_forward" className="text-sm transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {editing !== undefined && <UptimeMonitorDialog monitor={editing} onClose={() => setEditing(undefined)} onSave={saveMonitor} />}
      <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void deleteMonitor()} title={t('업타임을 삭제할까요?')} message={t('삭제하면 수집된 상태와 체크 기록도 함께 삭제됩니다.')} confirmLabel={t('삭제')} isProcessing={processingDelete} />
    </div>
  );
}
