import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, EmptyState, Input, MaterialIcon, PageHeader, Select } from '../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import {
  api,
  type ConnectedAgent,
  type ObservedService,
  type Project,
  type ProjectInput,
  type UptimeMonitor,
  type InfrastructureResource,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

function ProjectDialog({ project, onClose, onSave }: {
  project: Project | null;
  onClose: () => void;
  onSave: (input: ProjectInput) => Promise<void>;
}) {
  const { t } = useTranslate();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try { await onSave({ name, description }); onClose(); }
    catch (error) { toast.error(getErrorMessage(error)); }
    finally { setSaving(false); }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="project-dialog-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }} className={`m-auto w-full max-w-md overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-2xl ${SCRIM_MODAL_DIALOG}`}>
      <form onSubmit={submit}>
        <div className="border-b border-ui-border px-6 py-4"><h2 id="project-dialog-title" className="text-lg font-bold text-text-base">{t(project ? 'Project 수정' : 'Project 추가')}</h2></div>
        <div className="space-y-4 p-6">
          <label className="block space-y-1.5" htmlFor="project-name"><span className="text-sm font-semibold text-text-secondary">{t('이름')}</span><Input id="project-name" required value={name} onChange={event => setName(event.target.value)} placeholder={t('예: Production')} /></label>
          <label className="block space-y-1.5" htmlFor="project-description"><span className="text-sm font-semibold text-text-secondary">{t('설명')}</span><Input id="project-description" value={description} onChange={event => setDescription(event.target.value)} placeholder={t('선택 사항')} /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{t('취소')}</Button><Button type="submit" disabled={saving}>{t(project ? '저장' : '추가')}</Button></div>
      </form>
    </dialog>
  );
}

function AssignedRow({ label, detail, onRemove, removeLabel }: { label: string; detail?: string; onRemove: () => void; removeLabel: string }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-ui-border-soft px-3 py-2"><span className="min-w-0 truncate text-sm text-text-secondary">{label}{detail && <span className="ml-1 font-mono text-xs text-text-dim">{detail}</span>}</span><Button variant="ghost" size="sm" aria-label={removeLabel} onClick={onRemove}><MaterialIcon name="close" /></Button></div>;
}

function ProjectCard({ project, agents, monitors, directServices, infrastructureResources, unassignedAgents, unassignedMonitors, unassignedDirect, unassignedInfrastructure, onEdit, onDelete, onAssignAgent, onUnassignAgent, onAssignMonitor, onUnassignMonitor, onAssignDirect, onUnassignDirect, onAssignInfrastructure, onUnassignInfrastructure }: {
  project: Project;
  agents: ConnectedAgent[];
  monitors: UptimeMonitor[];
  directServices: ObservedService[];
  infrastructureResources: InfrastructureResource[];
  unassignedAgents: ConnectedAgent[];
  unassignedMonitors: UptimeMonitor[];
  unassignedDirect: ObservedService[];
  unassignedInfrastructure: InfrastructureResource[];
  onEdit: () => void;
  onDelete: () => void;
  onAssignAgent: (id: string) => void;
  onUnassignAgent: (id: string) => void;
  onAssignMonitor: (id: string) => void;
  onUnassignMonitor: (id: string) => void;
  onAssignDirect: (id: string) => void;
  onUnassignDirect: (id: string) => void;
  onAssignInfrastructure: (id: string) => void;
  onUnassignInfrastructure: (id: string) => void;
}) {
  const { t } = useTranslate();
  const [agentId, setAgentId] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [directId, setDirectId] = useState('');
  const [infrastructureId, setInfrastructureId] = useState('');
  const empty = agents.length === 0 && monitors.length === 0 && directServices.length === 0 && infrastructureResources.length === 0;

  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-bold text-text-base">{project.name}</h2><p className="mt-1 text-sm text-text-muted">{project.description || t('설명이 없습니다')}</p></div>
        <div className="flex gap-1"><Button variant="ghost" size="sm" aria-label={t('Project 수정')} onClick={onEdit}><MaterialIcon name="edit" /></Button><Button variant="ghost" size="sm" aria-label={t('Project 삭제')} onClick={onDelete}><MaterialIcon name="delete" className="text-status-error" /></Button></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[[t('Agent'), agents.length], [t('업타임'), monitors.length], [t('직접 서비스'), directServices.length], [t('Collector'), infrastructureResources.length]].map(([label, count]) => <div key={String(label)} className="rounded-lg bg-ui-hover-soft p-3"><p className="text-xs text-text-dim">{label}</p><p className="mt-1 font-mono text-lg font-bold text-text-base">{count}</p></div>)}
      </div>
      <div className="mt-5 space-y-2">
        {agents.map(agent => <AssignedRow key={agent.id} label={agent.name} detail="Agent" removeLabel={t('Agent 해제')} onRemove={() => onUnassignAgent(agent.id)} />)}
        {monitors.map(monitor => <AssignedRow key={monitor.id} label={monitor.name} detail={monitor.type.toUpperCase()} removeLabel={t('업타임 해제')} onRemove={() => onUnassignMonitor(monitor.id)} />)}
        {directServices.map(service => <AssignedRow key={service.id} label={service.name} detail={service.signals.join(' · ')} removeLabel={t('직접 서비스 해제')} onRemove={() => onUnassignDirect(service.id)} />)}
        {infrastructureResources.map(resource => <AssignedRow key={resource.id} label={resource.name} detail="Collector" removeLabel={t('Collector 해제')} onRemove={() => onUnassignInfrastructure(resource.id)} />)}
        {empty && <p className="text-sm text-text-dim">{t('아직 배정된 대상이 없습니다')}</p>}
      </div>
      {(unassignedAgents.length > 0 || unassignedMonitors.length > 0 || unassignedDirect.length > 0 || unassignedInfrastructure.length > 0) && (
        <div className="mt-5 space-y-2 border-t border-ui-border pt-4">
          {unassignedAgents.length > 0 && <div className="flex gap-2"><Select value={agentId} onChange={event => setAgentId(event.target.value)} aria-label={t('Agent 추가')}><option value="">{t('Agent 추가')}</option>{unassignedAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</Select><Button variant="secondary" disabled={!agentId} onClick={() => { onAssignAgent(agentId); setAgentId(''); }}>{t('배정')}</Button></div>}
          {unassignedMonitors.length > 0 && <div className="flex gap-2"><Select value={monitorId} onChange={event => setMonitorId(event.target.value)} aria-label={t('업타임 모니터 추가')}><option value="">{t('업타임 모니터 추가')}</option>{unassignedMonitors.map(monitor => <option key={monitor.id} value={monitor.id}>{monitor.name}</option>)}</Select><Button variant="secondary" disabled={!monitorId} onClick={() => { onAssignMonitor(monitorId); setMonitorId(''); }}>{t('배정')}</Button></div>}
          {unassignedDirect.length > 0 && <div className="flex gap-2"><Select value={directId} onChange={event => setDirectId(event.target.value)} aria-label={t('직접 서비스 추가')}><option value="">{t('직접 서비스 추가')}</option>{unassignedDirect.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</Select><Button variant="secondary" disabled={!directId} onClick={() => { onAssignDirect(directId); setDirectId(''); }}>{t('배정')}</Button></div>}
          {unassignedInfrastructure.length > 0 && <div className="flex gap-2"><Select value={infrastructureId} onChange={event => setInfrastructureId(event.target.value)} aria-label={t('Collector 추가')}><option value="">{t('Collector 추가')}</option>{unassignedInfrastructure.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</Select><Button variant="secondary" disabled={!infrastructureId} onClick={() => { onAssignInfrastructure(infrastructureId); setInfrastructureId(''); }}>{t('배정')}</Button></div>}
        </div>
      )}
    </article>
  );
}

export function ProjectsPage() {
  const { t } = useTranslate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [directServices, setDirectServices] = useState<ObservedService[]>([]);
  const [infrastructureResources, setInfrastructureResources] = useState<InfrastructureResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [projectRows, agentRows, monitorRows, directRows, infrastructureRows] = await Promise.all([api.getProjects(), api.getAgents(), api.getUptimeMonitors(), api.getObservedServices(), api.getInfrastructureResources()]);
      setProjects(projectRows ?? []); setAgents(agentRows ?? []); setMonitors(monitorRows ?? []); setDirectServices(directRows ?? []); setInfrastructureResources((infrastructureRows ?? []).filter(resource => resource.adapter === 'otel-collector'));
    } catch (requestError) { setError(getErrorMessage(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const mutate = async (work: () => Promise<unknown>) => { try { await work(); await load(); } catch (requestError) { toast.error(getErrorMessage(requestError)); } };
  const updateDirectProject = (serviceId: string, projectId?: string) => {
    const service = directServices.find(row => row.id === serviceId);
    if (!service) return Promise.resolve();
    return api.updateObservedService(service.id, { name: service.name, projectId, signals: service.signals });
  };
  const updateInfrastructureProject = (resourceId: string, projectId?: string) => {
    const resource = infrastructureResources.find(row => row.id === resourceId);
    if (!resource) return Promise.resolve();
    return api.updateInfrastructureResource(resource.id, { name: resource.name, projectId });
  };
  const saveProject = async (input: ProjectInput) => { if (editing) await api.updateProject(editing.id, input); else await api.createProject(input); await load(); };
  const deleteProject = async () => {
    if (!deleting) return;
    setDeletingProject(true);
    try { await api.deleteProject(deleting.id); setDeleting(null); await load(); }
    catch (requestError) { toast.error(getErrorMessage(requestError)); }
    finally { setDeletingProject(false); }
  };
  const unassignedAgents = agents.filter(agent => !agent.projectId);
  const unassignedMonitors = monitors.filter(monitor => !monitor.projectId);
  const unassignedDirect = directServices.filter(service => !service.projectId);
  const unassignedInfrastructure = infrastructureResources.filter(resource => !resource.projectId);

  return <div>
    <PageHeader title={t('Projects')} subtitle={t('Agent, 업타임 모니터, 직접 Observed Service와 Collector를 논리적으로 묶습니다.')}><Button onClick={() => setEditing(null)}><MaterialIcon name="add" />{t('Project 추가')}</Button></PageHeader>
    {loading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[0, 1].map(item => <div key={item} className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div> : error ? <EmptyState icon="error_outline" title={t('Project를 불러오지 못했습니다')} description={error} /> : projects.length === 0 ? <EmptyState icon="folder_open" title={t('아직 Project가 없습니다')} description={t('필요할 때 모니터링 대상을 묶어 보세요.')} action={{ label: t('Project 추가'), onClick: () => setEditing(null) }} /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{projects.map(project => <ProjectCard key={project.id} project={project} agents={agents.filter(agent => agent.projectId === project.id)} monitors={monitors.filter(monitor => monitor.projectId === project.id)} directServices={directServices.filter(service => service.projectId === project.id)} infrastructureResources={infrastructureResources.filter(resource => resource.projectId === project.id)} unassignedAgents={unassignedAgents} unassignedMonitors={unassignedMonitors} unassignedDirect={unassignedDirect} unassignedInfrastructure={unassignedInfrastructure} onEdit={() => setEditing(project)} onDelete={() => setDeleting(project)} onAssignAgent={id => void mutate(() => api.assignAgent(project.id, id))} onUnassignAgent={id => void mutate(() => api.unassignAgent(project.id, id))} onAssignMonitor={id => void mutate(() => api.assignMonitor(project.id, id))} onUnassignMonitor={id => void mutate(() => api.unassignMonitor(project.id, id))} onAssignDirect={id => void mutate(() => updateDirectProject(id, project.id))} onUnassignDirect={id => void mutate(() => updateDirectProject(id))} onAssignInfrastructure={id => void mutate(() => updateInfrastructureProject(id, project.id))} onUnassignInfrastructure={id => void mutate(() => updateInfrastructureProject(id))} />)}</div>}
    {editing !== undefined && <ProjectDialog project={editing} onClose={() => setEditing(undefined)} onSave={saveProject} />}
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void deleteProject()} title={t('Project를 삭제할까요?')} message={t('배정된 Agent, 업타임 모니터, 직접 서비스와 Collector는 삭제되지 않고 미분류로 남습니다.')} confirmLabel={t('삭제')} isProcessing={deletingProject} />
  </div>;
}
