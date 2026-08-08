import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import {
  Button, ConfirmDialog, EmptyState, Input, MaterialIcon, PageHeader, SearchInput, Select, StatusBadge,
} from '../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import { api, type AgentServiceFlat, type UptimeMonitor, type UptimeMonitorInput, type UptimeMonitorType } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

type MonitorDraft = {
  name: string;
  type: UptimeMonitorType;
  target: string;
  port: number;
  interval: number;
  timeout: number;
};

const EMPTY_DRAFT: MonitorDraft = {
  name: '', type: 'http', target: '', port: 443, interval: 30, timeout: 5000,
};

function ServiceListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />
      ))}
    </div>
  );
}

function statusLabel(status: UptimeMonitor['status']) {
  if (status === 'healthy') return '정상';
  if (status === 'unhealthy') return '장애';
  return '확인 대기';
}

function MonitorDialog({
  monitor,
  onClose,
  onSave,
}: {
  monitor: UptimeMonitor | null;
  onClose: () => void;
  onSave: (input: UptimeMonitorInput) => Promise<void>;
}) {
  const { t } = useTranslate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<MonitorDraft>(() => monitor ? {
    name: monitor.name,
    type: monitor.type,
    target: monitor.url,
    port: monitor.port ?? 443,
    interval: monitor.interval,
    timeout: monitor.timeout,
  } : EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const update = <K extends keyof MonitorDraft>(key: K, value: MonitorDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name: draft.name,
        type: draft.type,
        ...(draft.type === 'http' ? { url: draft.target } : { host: draft.target, port: draft.port }),
        interval: draft.interval,
        timeout: draft.timeout,
      });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="uptime-monitor-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
      className={`m-auto w-full max-w-lg overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-2xl ${SCRIM_MODAL_DIALOG}`}
    >
      <form onSubmit={submit}>
        <div className="flex items-center justify-between gap-3 border-b border-ui-border px-6 py-4">
          <div>
            <h2 id="uptime-monitor-dialog-title" className="text-lg font-bold text-text-base">
              {t(monitor ? '업타임 수정' : '업타임 추가')}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t('Agent 없이 HTTP 또는 TCP 상태를 확인합니다.')}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label={t('닫기')} onClick={onClose} disabled={saving}>
            <MaterialIcon name="close" />
          </Button>
        </div>
        <div className="space-y-4 p-6">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-text-secondary">{t('이름')}</span>
            <Input required value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder={t('예: 공개 API')} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-text-secondary">{t('체크 방식')}</span>
            <Select value={draft.type} onChange={(event) => update('type', event.target.value as UptimeMonitorType)} disabled={Boolean(monitor)}>
              <option value="http">HTTP</option>
              <option value="tcp">TCP</option>
            </Select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-text-secondary">{t(draft.type === 'http' ? 'URL' : '호스트')}</span>
            <Input required mono value={draft.target} onChange={(event) => update('target', event.target.value)} placeholder={draft.type === 'http' ? 'https://api.example.com/health' : 'db.example.com'} />
          </label>
          {draft.type === 'tcp' && (
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-text-secondary">{t('포트')}</span>
              <Input required type="number" min={1} max={65535} value={draft.port} onChange={(event) => update('port', Number(event.target.value))} />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-text-secondary">{t('주기 (초)')}</span>
              <Input required type="number" min={5} value={draft.interval} onChange={(event) => update('interval', Number(event.target.value))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-text-secondary">{t('타임아웃 (ms)')}</span>
              <Input required type="number" min={1} value={draft.timeout} onChange={(event) => update('timeout', Number(event.target.value))} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{t('취소')}</Button>
          <Button type="submit" disabled={saving}>
            {saving && <MaterialIcon name="sync" className="animate-spin" />}
            {t(monitor ? '저장' : '추가')}
          </Button>
        </div>
      </form>
    </dialog>
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
      <PageHeader title={t('업타임')} subtitle={t('Agent가 찾은 서비스와 독립 HTTP/TCP 모니터를 한곳에서 확인합니다.')}>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('서비스 또는 대상 검색')} aria-label={t('서비스 또는 대상 검색')} wrapperClassName="w-full sm:w-72" />
          <Button onClick={() => setEditing(null)}><MaterialIcon name="add" />{t('업타임 추가')}</Button>
        </div>
      </PageHeader>

      {loading ? <ServiceListSkeleton /> : error ? (
        <EmptyState icon="error_outline" title={t('대상을 불러오지 못했습니다')} description={error} />
      ) : empty ? (
        <EmptyState icon="monitor_heart" title={t(normalizedQuery ? '검색 결과가 없습니다' : '표시할 업타임 대상이 없습니다')} description={t(normalizedQuery ? '검색어를 바꿔 다시 시도해 보세요.' : 'Agent를 연결하거나 독립 업타임을 추가해 보세요.')} />
      ) : (
        <div className="space-y-8">
          {filteredMonitors.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2"><MaterialIcon name="public" className="text-lg text-primary" /><h2 className="text-base font-bold text-text-base">{t('독립 모니터')}</h2></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredMonitors.map((monitor) => (
                  <article key={monitor.id} className="flex min-h-36 flex-col gap-3 rounded-xl border border-ui-border bg-bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><h3 className="truncate text-base font-bold text-text-base">{monitor.name}</h3><p className="mt-1 text-xs text-text-muted">{t('독립 HTTP/TCP 모니터')}</p></div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${monitor.status === 'healthy' ? 'bg-status-success/10 text-status-success' : monitor.status === 'unhealthy' ? 'bg-status-error/10 text-status-error' : 'bg-ui-active text-text-muted'}`}>{t(statusLabel(monitor.status))}</span>
                    </div>
                    <p className="truncate font-mono text-xs text-text-dim">{monitor.type === 'tcp' ? `${monitor.url}:${monitor.port}` : monitor.url}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 text-xs text-text-muted"><span>{monitor.type.toUpperCase()} · {monitor.interval}{t('초')}</span><span>{monitor.isActive ? t('활성') : t('일시정지')}</span></div>
                    <div className="flex gap-2 border-t border-ui-border pt-3">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => void setActive(monitor)}>{t(monitor.isActive ? '일시정지' : '재개')}</Button>
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

      {editing !== undefined && <MonitorDialog monitor={editing} onClose={() => setEditing(undefined)} onSave={saveMonitor} />}
      <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void deleteMonitor()} title={t('업타임을 삭제할까요?')} message={t('삭제하면 수집된 상태와 체크 기록도 함께 삭제됩니다.')} confirmLabel={t('삭제')} isProcessing={processingDelete} />
    </div>
  );
}
