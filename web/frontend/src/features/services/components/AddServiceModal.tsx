import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/common/Button';
import { CopyButton } from '../../../components/common/CopyButton';
import { MaterialIcon } from '../../../components/common/MaterialIcon';
import { api, type AgentServiceSnapshot, type ConnectedAgent } from '../../../services/api';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import { getErrorMessage } from '../../../utils/errors';
import { toast } from 'react-hot-toast';
import { MonitoringSetupPanel } from './MonitoringSetupPanel';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  existingAgent?: { id: string; name: string };
  onOpenProject?: (agentId: string) => void;
  onConfigureInstrumentation?: (agentId: string) => void;
}

type Step = 'form' | 'install';

function SetupProgress({ step, connected, diagnosed }: { step: Step; connected: boolean; diagnosed: boolean }) {
  const steps = [
    { label: '프로젝트', complete: step === 'install', active: step === 'form' },
    { label: 'Agent', complete: connected, active: step === 'install' && !connected },
    { label: '기능 확인', complete: diagnosed, active: connected && !diagnosed },
    { label: '상세 계측', complete: false, active: diagnosed },
  ];
  return (
    <div className="border-b border-ui-border-soft px-6 py-3">
      <div className="grid grid-cols-4 gap-1">
        {steps.map((item, index) => (
          <div key={item.label} className="flex min-w-0 items-center gap-1.5">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${
              item.complete
                ? 'bg-emerald-500 text-white'
                : item.active ? 'bg-primary text-white' : 'bg-ui-hover text-text-dim'
            }`}>
              {item.complete ? <MaterialIcon name="check" className="text-xs" /> : index + 1}
            </span>
            <span className={`truncate text-2xs font-semibold ${item.active ? 'text-primary' : item.complete ? 'text-text-secondary' : 'text-text-dim'}`}>
              {item.label}
            </span>
            {index < steps.length - 1 && <span className="hidden h-px flex-1 bg-ui-border sm:block" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function initialWebBaseUrl(): string {
  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return '';
  }
  return origin;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildInstallCommand(webBaseUrl: string, joinCode: string): string {
  const baseUrl = webBaseUrl.trim().replace(/\/+$/, '') || 'http://EVERYUP_WEB_SERVER:3001';
  return `curl -fsSL ${shellQuote(`${baseUrl}/api/v1/agents/install.sh`)} | sudo sh -s -- ${shellQuote(baseUrl)} ${shellQuote(joinCode)}`;
}

async function copyInstallCommand(text: string): Promise<boolean> {
  // copyTextToClipboard falls back to a textarea + execCommand on plain HTTP,
  // where navigator.clipboard is unavailable (non-secure context).
  try {
    await copyTextToClipboard(text);
    return true;
  } catch {
    toast.error('복사에 실패했습니다. 내용을 직접 선택해 복사하세요.');
    return false;
  }
}

function ProjectForm({
  name,
  submitting,
  onNameChange,
  onClose,
  onSubmit,
}: {
  name: string;
  submitting: boolean;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="p-6 space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-secondary">
          프로젝트 이름
        </label>
        <input
          type="text"
          value={name}
          onChange={event => onNameChange(event.target.value)}
          placeholder="예: my-api, payment-service"
          className="w-full px-3 py-2.5 rounded-xl text-sm bg-ui-hover-soft border border-ui-border text-text-base placeholder-slate-400 dark:placeholder-text-dim-dark focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
        <p className="text-xs text-text-dim">
          에이전트 Docker 이미지에 설정할 이름입니다
        </p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
          취소
        </Button>
        <Button type="submit" disabled={!name.trim() || submitting} className="flex-1">
          {submitting ? '생성 중...' : '생성'}
        </Button>
      </div>
    </form>
  );
}

function AgentInstallCommand({
  connected,
  expanded,
  expiryLabel,
  refreshingCode,
  webBaseUrl,
  webAddressMissing,
  installCommand,
  codeUnavailable,
  onRefreshCode,
  onWebBaseUrlChange,
}: {
  connected: boolean;
  expanded: boolean;
  expiryLabel: string;
  refreshingCode: boolean;
  webBaseUrl: string;
  webAddressMissing: boolean;
  installCommand: string;
  codeUnavailable: boolean;
  onRefreshCode: () => void;
  onWebBaseUrlChange: (value: string) => void;
}) {
  return (
    <details open={expanded} className="group rounded-xl border border-ui-border bg-bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-text-base">
        <MaterialIcon name="terminal" className="text-lg text-primary" />
        Agent 설치 명령
        <span className="ml-auto text-xs font-normal text-text-dim">
          {connected ? '재설치할 때 사용' : 'Linux Docker 서버에서 실행'}
        </span>
        <MaterialIcon name="expand_more" className="text-base text-text-dim transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-ui-border-soft p-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <MaterialIcon name="timer" className="mt-0.5 shrink-0 text-lg text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">일회용 연결 코드</p>
            <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
              {expiryLabel || '10분 후'}까지 한 번만 사용할 수 있습니다. 장기 API 키는 서버에 직접 저장됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshCode}
            disabled={refreshingCode}
            className="shrink-0 text-xs font-semibold text-amber-700 hover:underline disabled:opacity-50 dark:text-amber-300"
          >
            {refreshingCode ? '발급 중' : '새 코드'}
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="agent-web-base-url" className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Agent에서 접근할 EveryUp Web 주소
          </label>
          <input
            id="agent-web-base-url"
            type="url"
            value={webBaseUrl}
            onChange={(event) => onWebBaseUrlChange(event.target.value)}
            placeholder="예: http://192.168.0.10:3001"
            className={`w-full rounded-xl border bg-ui-hover-soft px-3 py-2.5 text-sm text-text-base placeholder-slate-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/30 dark:placeholder-text-dim-dark ${webAddressMissing ? 'border-amber-300 dark:border-amber-700' : 'border-ui-border'}`}
          />
          <p className={`text-xs ${webAddressMissing ? 'text-amber-600 dark:text-amber-400' : 'text-text-dim'}`}>
            {webAddressMissing
              ? 'Agent 컨테이너에서 접근 가능한 서버 IP나 도메인을 입력하세요.'
              : 'localhost는 Agent 자신을 가리키므로 원격 설치에는 사용할 수 없습니다.'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-base">설치 명령</p>
              <p className="mt-0.5 text-xs text-text-muted">검사, 설정 백업, Agent·eBPF 시작을 한 번에 처리합니다.</p>
            </div>
            <CopyButton
              onCopy={() => copyInstallCommand(installCommand)}
              title={webAddressMissing ? 'Web 주소를 먼저 입력하세요' : '설치 명령 복사'}
              disabled={webAddressMissing || codeUnavailable}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              iconClassName="text-base"
            >
              <span>복사</span>
            </CopyButton>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100 dark:bg-black">
            {codeUnavailable ? '일회용 연결 코드를 발급하는 중입니다...' : installCommand}
          </pre>
        </div>

        <div className="grid gap-2 text-xs text-text-muted sm:grid-cols-3">
          {[
            ['rule', '환경 검사', 'Docker와 Compose 조건을 먼저 확인'],
            ['backup', '안전한 설치', '기존 설정을 백업하고 새 설정 저장'],
            ['sensors', '자동 발견', 'Agent와 eBPF Observer를 함께 시작'],
          ].map(([icon, title, description]) => (
            <div key={title} className="rounded-lg bg-ui-hover-soft p-2.5">
              <MaterialIcon name={icon} className="text-base text-primary" />
              <p className="mt-1 font-semibold text-text-secondary">{title}</p>
              <p className="mt-0.5 text-2xs leading-relaxed text-text-dim">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function AddServiceModal({
  onClose,
  onCreated,
  existingAgent,
  onOpenProject,
  onConfigureInstrumentation,
}: Props) {
  const [step, setStep] = useState<Step>(existingAgent ? 'install' : 'form');
  const [name, setName] = useState(existingAgent?.name ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(Boolean(existingAgent));
  const [agentId, setAgentId] = useState(existingAgent?.id ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [webBaseUrl, setWebBaseUrl] = useState(initialWebBaseUrl);
  const [connectedAgent, setConnectedAgent] = useState<ConnectedAgent | null>(null);
  const [detectedServices, setDetectedServices] = useState<AgentServiceSnapshot[]>([]);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const requestedExistingCode = useRef(false);
  const announcedConnection = useRef(false);
  const checkedConnectionOnce = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    if (!existingAgent || requestedExistingCode.current) return;
    requestedExistingCode.current = true;
    let active = true;
    api.createAgentJoinCode(existingAgent.id)
      .then((res) => {
        if (!active) return;
        setJoinCode(res.joinCode);
        setExpiresAt(res.expiresAt);
      })
      .catch((err) => {
        if (active) toast.error(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setRefreshingCode(false);
      });
    return () => { active = false; };
  }, [existingAgent]);

  const refreshConnection = useCallback(async (showLoading = false) => {
    if (!agentId) return;
    if (showLoading) setCheckingConnection(true);
    try {
      const [agents, serviceList] = await Promise.all([
        api.getAgents(),
        api.getAgentServices(agentId),
      ]);
      const current = (agents ?? []).find((candidate) => candidate.id === agentId);
      const isConnected = Boolean(current && (current.version || current.capabilities || serviceList.length > 0));
      const firstCheck = !checkedConnectionOnce.current;
      checkedConnectionOnce.current = true;
      if (!current || !isConnected) return;
      setConnectedAgent(current);
      setDetectedServices(serviceList ?? []);
      if (!announcedConnection.current) {
        announcedConnection.current = true;
        if (!firstCheck) toast.success('Agent 연결을 확인했습니다');
        onCreated();
      }
    } catch (error) {
      if (showLoading) toast.error(getErrorMessage(error));
    } finally {
      if (showLoading) setCheckingConnection(false);
    }
  }, [agentId, onCreated]);

  useEffect(() => {
    if (step !== 'install' || !agentId) return;
    void refreshConnection(false);
    const timer = window.setInterval(() => void refreshConnection(false), 5_000);
    return () => window.clearInterval(timer);
  }, [agentId, refreshConnection, step]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await api.createAgent(trimmed);
      setAgentId(res.id);
      setJoinCode(res.joinCode);
      setExpiresAt(res.expiresAt);
      setStep('install');
      onCreated();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshCode = async () => {
    if (!agentId) return;
    setRefreshingCode(true);
    try {
      const res = await api.createAgentJoinCode(agentId);
      setJoinCode(res.joinCode);
      setExpiresAt(res.expiresAt);
      toast.success('새 연결 코드를 발급했습니다');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRefreshingCode(false);
    }
  };

  const installCommand = buildInstallCommand(webBaseUrl, joinCode);
  const webAddressMissing = !webBaseUrl.trim();
  const codeUnavailable = !joinCode || refreshingCode;
  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const connected = connectedAgent !== null;
  const diagnosed = Boolean(connectedAgent?.capabilities);
  const injectableCount = detectedServices.filter(
    (service) => service.runtime === 'java' || service.runtime === 'node',
  ).length;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-4 backdrop:bg-black/40 backdrop:backdrop-blur-sm open:flex"
      aria-label={step === 'form' ? '프로젝트 추가' : 'Agent 설치 및 모니터링 설정'}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className={`w-full ${step === 'install' ? 'max-w-2xl' : 'max-w-md'} max-h-[92vh] bg-bg-surface rounded-2xl shadow-2xl border border-ui-border overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border-soft">
          <h2 className="text-base font-semibold text-text-base">
            {step === 'form' ? '프로젝트 추가' : 'Agent 설치'}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded-lg text-slate-400 hover:text-text-base transition-colors">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <SetupProgress step={step} connected={connected} diagnosed={diagnosed} />

        {step === 'form' ? (
          <ProjectForm
            name={name}
            submitting={submitting}
            onNameChange={setName}
            onClose={onClose}
            onSubmit={handleCreate}
          />
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            {connected ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <MaterialIcon name="check_circle" className="mt-0.5 shrink-0 text-xl text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Agent 연결을 확인했습니다</p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    기능 호환성과 발견된 서비스를 자동으로 확인했습니다. 이 화면에서 선택 계측까지 이어서 설정할 수 있습니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-base">Agent 연결을 기다리는 중</p>
                  <p className="mt-0.5 text-xs text-text-muted">명령을 실행하면 최대 5초 간격으로 자동 확인합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshConnection(true)}
                  disabled={checkingConnection}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {checkingConnection ? '확인 중' : '지금 확인'}
                </button>
              </div>
            )}

            {connectedAgent && (
              <MonitoringSetupPanel
                agent={connectedAgent}
                services={detectedServices}
                compact
                onInstrument={injectableCount > 0 && onConfigureInstrumentation
                  ? () => onConfigureInstrumentation(agentId)
                  : undefined}
              />
            )}

            <AgentInstallCommand
              connected={connected}
              expanded={!connected || Boolean(existingAgent)}
              expiryLabel={expiryLabel}
              refreshingCode={refreshingCode}
              webBaseUrl={webBaseUrl}
              webAddressMissing={webAddressMissing}
              installCommand={installCommand}
              codeUnavailable={codeUnavailable}
              onRefreshCode={handleRefreshCode}
              onWebBaseUrlChange={setWebBaseUrl}
            />

            <div className="flex gap-2">
              {connected ? (
                <>
                  {injectableCount > 0 && onConfigureInstrumentation && (
                    <Button
                      variant="secondary"
                      onClick={() => onConfigureInstrumentation(agentId)}
                      className="flex-1"
                    >
                      상세 계측 설정
                    </Button>
                  )}
                  <Button
                    onClick={() => onOpenProject ? onOpenProject(agentId) : onClose()}
                    className="flex-1"
                  >
                    {onOpenProject ? '프로젝트 열기' : '완료'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={onClose} className="flex-1">
                    나중에 확인
                  </Button>
                  <Button
                    onClick={() => void refreshConnection(true)}
                    disabled={checkingConnection}
                    className="flex-1"
                  >
                    {checkingConnection ? '연결 확인 중...' : '연결 확인'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
