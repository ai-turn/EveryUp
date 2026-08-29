import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslate } from '@tolgee/react';
import { toast } from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DetailActionToolbar,
  EmptyState,
  MaterialIcon,
  PageHeader,
  Select,
  TimeRangePicker,
  type GlobalTimeRange,
} from '../../components/common';
import { DirectServiceLogsTab } from '../../features/healthcheck/components/AgentServiceLogsTab';
import { RotatedTelemetryKeyDialog } from '../../features/telemetry/components/RotatedTelemetryKeyDialog';
import { api, type ObservedService, type ObservedServiceSetup, type Project } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

type ConfirmAction = 'rotate' | 'revoke' | 'delete' | null;

export function DirectLogsDetailPage() {
  const { t } = useTranslate();
  const { serviceId = '' } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState<ObservedService | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [range, setRange] = useState<GlobalTimeRange>('6h');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [processing, setProcessing] = useState(false);
  const [rotatedSetup, setRotatedSetup] = useState<ObservedServiceSetup | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [serviceRow, projectRows] = await Promise.all([
        api.getObservedService(serviceId),
        api.getProjects(),
      ]);
      if (!serviceRow.signals.includes('logs')) {
        setError(t('이 서비스에는 Logs 기능이 연결되어 있지 않습니다.'));
        return;
      }
      setService(serviceRow);
      setProjectId(serviceRow.projectId ?? '');
      setProjects(projectRows ?? []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [serviceId, t]);

  useEffect(() => { void load(); }, [load]);

  const saveProject = async () => {
    if (!service) return;
    setSavingProject(true);
    try {
      const updated = await api.updateObservedService(service.id, {
        name: service.name,
        projectId: projectId || undefined,
        signals: service.signals,
      });
      setService(updated);
      toast.success(t('Project 배정을 저장했습니다.'));
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setSavingProject(false);
    }
  };

  const runConfirmedAction = async () => {
    if (!service || !confirmAction) return;
    setProcessing(true);
    try {
      if (confirmAction === 'rotate') {
        const setup = await api.rotateObservedServiceKey(service.id);
        setService(setup);
        setRotatedSetup(setup);
      } else if (confirmAction === 'revoke') {
        setService(await api.revokeObservedServiceKey(service.id));
        toast.success(t('직접 수집 연결을 중지했습니다.'));
      } else {
        await api.deleteObservedService(service.id);
        toast.success(t('직접 로그 서비스를 삭제했습니다.'));
        navigate('/logs', { replace: true });
      }
      setConfirmAction(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="h-96 animate-pulse rounded-xl border border-ui-border bg-bg-surface" />;
  if (error || !service) return <EmptyState icon="error_outline" title={t('직접 로그 서비스를 불러오지 못했습니다')} description={error ?? undefined} action={{ label: t('로그로 돌아가기'), onClick: () => navigate('/logs') }} />;

  const confirmCopy = {
    rotate: {
      title: t('직접 수집 키를 재발급할까요?'),
      message: t('현재 키는 즉시 폐기됩니다. 모든 OpenTelemetry Exporter에 새 키를 반영해야 합니다.'),
      label: t('재발급'),
      variant: 'primary' as const,
    },
    revoke: {
      title: t('직접 수집 연결을 중지할까요?'),
      message: t('이 키를 사용한 새 로그 수집이 즉시 차단됩니다. 저장된 로그는 유지됩니다.'),
      label: t('연결 중지'),
      variant: 'danger' as const,
    },
    delete: {
      title: t('직접 로그 서비스를 삭제할까요?'),
      message: t('이 서비스의 로그, 직접 수집 연결, 대상별 알림 규칙이 함께 삭제됩니다.'),
      label: t('삭제'),
      variant: 'danger' as const,
    },
  };
  const selectedConfirm = confirmAction ? confirmCopy[confirmAction] : null;

  return (
    <div>
      <PageHeader title={service.name} subtitle={t('직접 연결한 OpenTelemetry 로그 서비스입니다.')} />
      <DetailActionToolbar
        controls={
          <>
          <TimeRangePicker value={range} onChange={setRange} />
          <Button variant="secondary" onClick={() => setRefreshKey(value => value + 1)}><MaterialIcon name="refresh" />{t('새로고침')}</Button>
          </>
        }
        actions={
          <>
          <Button variant="secondary" onClick={() => navigate('/alerts')}><MaterialIcon name="notifications" />{t('알림 규칙')}</Button>
          {service.isActive && <Button variant="ghost" onClick={() => setConfirmAction('revoke')}><MaterialIcon name="block" />{t('연결 중지')}</Button>}
          <Button variant="ghost" className="text-status-error hover:text-status-error" onClick={() => setConfirmAction('delete')}><MaterialIcon name="delete" />{t('삭제')}</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-ui-border bg-bg-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-base font-bold text-text-base">{t('직접 수집 연결')}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-bold ${service.isActive ? 'border-status-healthy/20 bg-status-healthy/10 text-status-healthy' : 'border-status-error/20 bg-status-error/10 text-status-error'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${service.isActive ? 'bg-status-healthy' : 'bg-status-error'}`} aria-hidden="true" />
              {service.isActive ? t('수집 가능') : t('중지됨')}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-ui-hover-soft p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-dim">{t('수집 키')}</p>
              <p className="mt-1 truncate font-mono text-sm font-semibold text-text-secondary">{service.apiKeyMasked || t('마스킹된 키 없음')}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAction('rotate')}><MaterialIcon name="key" />{t('키 재발급')}</Button>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-ui-hover-soft p-3"><dt className="text-xs text-text-dim">{t('마지막 수집')}</dt><dd className="mt-1 text-sm font-semibold text-text-secondary">{service.lastSeenAt ? new Date(service.lastSeenAt).toLocaleString() : t('아직 없음')}</dd></div>
            <div className="rounded-lg bg-ui-hover-soft p-3"><dt className="text-xs text-text-dim">{t('허용 신호')}</dt><dd className="mt-1 font-mono text-sm font-semibold text-text-secondary">{service.signals.join(', ')}</dd></div>
          </dl>
        </section>

        <section className="rounded-xl border border-ui-border bg-bg-surface p-5">
          <h2 className="text-base font-bold text-text-base">{t('Project')}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('직접 서비스는 Docker 환경과 별도로 Project에 배정됩니다.')}</p>
          <div className="mt-4 space-y-3">
            <Select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label={t('Project 선택')}>
              <option value="">{t('미분류')}</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
            <Button size="sm" onClick={() => void saveProject()} disabled={savingProject || projectId === (service.projectId ?? '')}>{savingProject ? t('저장 중...') : t('배정 저장')}</Button>
          </div>
        </section>
      </div>

      <DirectServiceLogsTab observedServiceId={service.id} refreshKey={refreshKey} range={range} />

      <ConfirmDialog
        isOpen={Boolean(selectedConfirm)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void runConfirmedAction()}
        title={selectedConfirm?.title ?? ''}
        message={selectedConfirm?.message ?? ''}
        confirmLabel={selectedConfirm?.label}
        variant={selectedConfirm?.variant}
        isProcessing={processing}
      />
      {rotatedSetup && <RotatedTelemetryKeyDialog setup={rotatedSetup} onClose={() => setRotatedSetup(null)} />}
    </div>
  );
}
