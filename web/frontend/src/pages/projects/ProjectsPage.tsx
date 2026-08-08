import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import { Button, ConfirmDialog, EmptyState, Input, MaterialIcon, PageHeader, Select } from '../../components/common';
import { SCRIM_MODAL_DIALOG } from '../../hooks/useOverlay';
import { api, type ConnectedAgent, type Project, type ProjectInput, type UptimeMonitor } from '../../services/api';
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
    try {
      await onSave({ name, description });
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="project-dialog-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }} className={`m-auto w-full max-w-md overflow-hidden rounded-xl border border-ui-border bg-bg-surface shadow-2xl ${SCRIM_MODAL_DIALOG}`}>
      <form onSubmit={submit}>
        <div className="border-b border-ui-border px-6 py-4"><h2 id="project-dialog-title" className="text-lg font-bold text-text-base">{t(project ? 'Project 수정' : 'Project 추가')}</h2></div>
        <div className="space-y-4 p-6">
          <label className="block space-y-1.5"><span className="text-sm font-semibold text-text-secondary">{t('이름')}</span><Input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t('예: Production')} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-semibold text-text-secondary">{t('설명')}</span><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('선택 사항')} /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-ui-border px-6 py-4"><Button type="button" variant="secondary" onClick={onClose} disabled={saving}>{t('취소')}</Button><Button type="submit" disabled={saving}>{t(project ? '저장' : '추가')}</Button></div>
      </form>
    </dialog>
  );
}

function ProjectCard({ project, agents, monitors, unassignedAgents, unassignedMonitors, onEdit, onDelete, onAssignAgent, onUnassignAgent, onAssignMonitor, onUnassignMonitor }: {
  project: Project;
  agents: ConnectedAgent[];
  monitors: UptimeMonitor[];
  unassignedAgents: ConnectedAgent[];
  unassignedMonitors: UptimeMonitor[];
  onEdit: () => void;
  onDelete: () => void;
  onAssignAgent: (agentId: string) => void;
  onUnassignAgent: (agentId: string) => void;
  onAssignMonitor: (monitorId: string) => void;
  onUnassignMonitor: (monitorId: string) => void;
}) {
  const { t } = useTranslate();
  const [agentID, setAgentID] = useState('');
  const [monitorID, setMonitorID] = useState('');
  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="truncate text-lg font-bold text-text-base">{project.name}</h2><p className="mt-1 text-sm text-text-muted">{project.description || t('설명이 없습니다')}</p></div>
        <div className="flex gap-1"><Button variant="ghost" size="sm" aria-label={t('Project 수정')} onClick={onEdit}><MaterialIcon name="edit" /></Button><Button variant="ghost" size="sm" aria-label={t('Project 삭제')} onClick={onDelete}><MaterialIcon name="delete" className="text-status-error" /></Button></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-lg bg-ui-hover-soft p-3"><p className="text-xs text-text-dim">{t('Agent')}</p><p className="mt-1 font-mono text-lg font-bold text-text-base">{agents.length}</p></div><div className="rounded-lg bg-ui-hover-soft p-3"><p className="text-xs text-text-dim">{t('독립 업타임')}</p><p className="mt-1 font-mono text-lg font-bold text-text-base">{monitors.length}</p></div></div>
      <div className="mt-5 space-y-2">
        {agents.map((agent) => <div key={agent.id} className="flex items-center justify-between gap-2 rounded-lg border border-ui-border-soft px-3 py-2"><span className="truncate text-sm text-text-secondary">{agent.name}</span><Button variant="ghost" size="sm" aria-label={t('Agent 해제')} onClick={() => onUnassignAgent(agent.id)}><MaterialIcon name="close" /></Button></div>)}
        {monitors.map((monitor) => <div key={monitor.id} className="flex items-center justify-between gap-2 rounded-lg border border-ui-border-soft px-3 py-2"><span className="truncate text-sm text-text-secondary">{monitor.name}<span className="ml-1 font-mono text-xs text-text-dim">{monitor.type.toUpperCase()}</span></span><Button variant="ghost" size="sm" aria-label={t('업타임 해제')} onClick={() => onUnassignMonitor(monitor.id)}><MaterialIcon name="close" /></Button></div>)}
        {agents.length === 0 && monitors.length === 0 && <p className="text-sm text-text-dim">{t('아직 배정된 대상이 없습니다')}</p>}
      </div>
      {(unassignedAgents.length > 0 || unassignedMonitors.length > 0) && <div className="mt-5 space-y-2 border-t border-ui-border pt-4">
        {unassignedAgents.length > 0 && <div className="flex gap-2"><Select value={agentID} onChange={(event) => setAgentID(event.target.value)}><option value="">{t('Agent 추가')}</option>{unassignedAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</Select><Button variant="secondary" disabled={!agentID} onClick={() => { onAssignAgent(agentID); setAgentID(''); }}>{t('배정')}</Button></div>}
        {unassignedMonitors.length > 0 && <div className="flex gap-2"><Select value={monitorID} onChange={(event) => setMonitorID(event.target.value)}><option value="">{t('독립 업타임 추가')}</option>{unassignedMonitors.map((monitor) => <option key={monitor.id} value={monitor.id}>{monitor.name}</option>)}</Select><Button variant="secondary" disabled={!monitorID} onClick={() => { onAssignMonitor(monitorID); setMonitorID(''); }}>{t('배정')}</Button></div>}
      </div>}
    </article>
  );
}

export function ProjectsPage() {
  const { t } = useTranslate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRows, agentRows, monitorRows] = await Promise.all([api.getProjects(), api.getAgents(), api.getUptimeMonitors()]);
      setProjects(projectRows ?? []);
      setAgents(agentRows ?? []);
      setMonitors(monitorRows ?? []);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mutate = async (work: () => Promise<unknown>) => {
    try { await work(); await load(); } catch (error) { toast.error(getErrorMessage(error)); }
  };
  const saveProject = async (input: ProjectInput) => { if (editing) await api.updateProject(editing.id, input); else await api.createProject(input); await load(); };
  const deleteProject = async () => {
    if (!deleting) return;
    setDeletingProject(true);
    try { await api.deleteProject(deleting.id); setDeleting(null); await load(); } catch (error) { toast.error(getErrorMessage(error)); } finally { setDeletingProject(false); }
  };
  const unassignedAgents = agents.filter((agent) => !agent.projectId);
  const unassignedMonitors = monitors.filter((monitor) => !monitor.projectId);

  return <div>
    <PageHeader title={t('Projects')} subtitle={t('Agent와 독립 업타임 대상을 논리적으로 묶습니다. 발견된 서비스와 텔레메트리는 Agent의 Project를 자동 상속합니다.')}><Button onClick={() => setEditing(null)}><MaterialIcon name="add" />{t('Project 추가')}</Button></PageHeader>
    {loading ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-72 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />)}</div> : error ? <EmptyState icon="error_outline" title={t('Project를 불러오지 못했습니다')} description={error} /> : projects.length === 0 ? <EmptyState icon="folder_open" title={t('아직 Project가 없습니다')} description={t('필요할 때만 Agent와 독립 업타임 대상을 묶어 보세요.')} action={{ label: t('Project 추가'), onClick: () => setEditing(null) }} /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{projects.map((project) => <ProjectCard key={project.id} project={project} agents={agents.filter((agent) => agent.projectId === project.id)} monitors={monitors.filter((monitor) => monitor.projectId === project.id)} unassignedAgents={unassignedAgents} unassignedMonitors={unassignedMonitors} onEdit={() => setEditing(project)} onDelete={() => setDeleting(project)} onAssignAgent={(agentId) => void mutate(() => api.assignAgent(project.id, agentId))} onUnassignAgent={(agentId) => void mutate(() => api.unassignAgent(project.id, agentId))} onAssignMonitor={(monitorId) => void mutate(() => api.assignMonitor(project.id, monitorId))} onUnassignMonitor={(monitorId) => void mutate(() => api.unassignMonitor(project.id, monitorId))} />)}</div>}
    {editing !== undefined && <ProjectDialog project={editing} onClose={() => setEditing(undefined)} onSave={saveProject} />}
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void deleteProject()} title={t('Project를 삭제할까요?')} message={t('배정된 Agent와 독립 업타임 대상은 삭제되지 않고 미분류로 남습니다.')} confirmLabel={t('삭제')} isProcessing={deletingProject} />
  </div>;
}
