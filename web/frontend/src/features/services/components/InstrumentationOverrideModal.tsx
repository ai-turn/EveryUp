import { useEffect, useState } from 'react';
import { CopyButton } from '../../../components/common/CopyButton';
import { MaterialIcon } from '../../../components/common/MaterialIcon';
import { Input } from '../../../components/common/Input';
import { Select } from '../../../components/common/Select';
import { useClipboardCopy } from '../../../hooks/useClipboardCopy';
import { api, type AgentServiceSnapshot } from '../../../services/api';
import { runtimeLabel } from '../../healthcheck/runtimeLabels';
import { useOverlay } from '../../../hooks/useOverlay';

interface Props {
  agentId: string;
  onClose: () => void;
}

const INJECTABLE = new Set(['java', 'node']);
const DOC_URL = 'https://github.com/ai-turn/everyup/blob/main/docs/OTEL_API_INSTRUMENTATION.ko.md';

function composeTargetOf(key: string): { project: string; service: string } | null {
  const separator = key.indexOf(':');
  if (separator <= 0 || separator === key.length - 1) return null;
  return { project: key.slice(0, separator), service: key.slice(separator + 1) };
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

function buildApplyCommand(
  webBaseUrl: string,
  composePath: string,
  targets: { composeService: string; runtime: string }[],
  captureBodies: boolean,
): string {
  const baseUrl = webBaseUrl.trim().replace(/\/+$/, '') || 'http://EVERYUP_WEB_SERVER:3001';
  const path = composePath.trim() || './docker-compose.yml';
  const targetArgs = targets
    .map(({ composeService, runtime }) => shellQuote(`${composeService}=${runtime}`))
    .join(' ');
  const bodyOption = captureBodies ? ' --capture-bodies' : '';
  const installCLI = [
    'tmp="$(mktemp)"',
    'trap \'rm -f "$tmp"\' EXIT',
    `curl -fsSL ${shellQuote(`${baseUrl}/api/v1/agents/otel.sh`)} -o "$tmp"`,
    'sudo install -m 0755 "$tmp" /usr/local/bin/everyup-otel',
  ].join(' && ');
  return `(${installCLI}) && sudo everyup-otel apply ${shellQuote(path)}${bodyOption} ${targetArgs}`;
}

function CommandRow({
  label,
  command,
  onCopy,
}: {
  label: string;
  command: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-ui-border bg-ui-hover-soft px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-muted">{label}</span>
        <CopyButton
          onCopy={() => onCopy(command)}
          title={`${label} 복사`}
          className="rounded p-1 text-slate-500 hover:text-primary"
          iconClassName="text-sm"
        />
      </div>
      <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs text-text-secondary">
        {command}
      </code>
    </div>
  );
}

export function InstrumentationOverrideModal({ agentId, onClose }: Props) {
  useOverlay(true, onClose);
  const { copy } = useClipboardCopy();
  const [services, setServices] = useState<AgentServiceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureBodies, setCaptureBodies] = useState(false);
  const [webBaseUrl, setWebBaseUrl] = useState(initialWebBaseUrl);
  const [composePath, setComposePath] = useState('./docker-compose.yml');
  const [composeProject, setComposeProject] = useState('');

  useEffect(() => {
    api.getAgentServices(agentId)
      .then((list) => setServices(list ?? []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  const targetsByProject = new Map<string, Map<string, { composeService: string; runtime: string; name: string }>>();
  services.forEach((service) => {
    if (!service.runtime || !INJECTABLE.has(service.runtime)) return;
    const target = composeTargetOf(service.key);
    if (!target) return;
    const projectTargets = targetsByProject.get(target.project) ?? new Map();
    if (!projectTargets.has(target.service)) {
      projectTargets.set(target.service, {
        composeService: target.service,
        runtime: service.runtime,
        name: service.name,
      });
    }
    targetsByProject.set(target.project, projectTargets);
  });
  const composeProjects = Array.from(targetsByProject.keys()).sort();
  const selectedProject = composeProjects.includes(composeProject) ? composeProject : (composeProjects[0] ?? '');
  const targets = Array.from(targetsByProject.get(selectedProject)?.values() ?? []);
  const skipped = services.filter(
    (service) => service.runtime && INJECTABLE.has(service.runtime) && !composeTargetOf(service.key),
  );
  const hasJava = targets.some((target) => target.runtime === 'java');
  const webAddressMissing = !webBaseUrl.trim();
  const composePathMissing = !composePath.trim();
  const applyCommand = buildApplyCommand(webBaseUrl, composePath, targets, captureBodies);
  const verifyCommand = `sudo everyup-otel verify ${shellQuote(composePath.trim() || './docker-compose.yml')}`;
  const statusCommand = `sudo everyup-otel status ${shellQuote(composePath.trim() || './docker-compose.yml')}`;
  const rollbackCommand = `sudo everyup-otel rollback ${shellQuote(composePath.trim() || './docker-compose.yml')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="OpenTelemetry 자동 적용"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex h-full max-h-full w-full max-w-2xl flex-col bg-bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-xl">
        <div className="flex items-center gap-3 border-b border-ui-border px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MaterialIcon name="integration_instructions" className="text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-text-base">상세 API 모니터링 적용</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              감지된 Java·Node.js 서비스에 OpenTelemetry를 안전하게 적용합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1.5 text-slate-400 hover:bg-ui-hover hover:text-text-secondary"
            aria-label="닫기"
          >
            <MaterialIcon name="close" className="text-base" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-ui-hover" />
          ) : targets.length === 0 ? (
            <div className="space-y-2 py-10 text-center">
              <MaterialIcon name="info" className="text-3xl text-text-dim" />
              <p className="text-sm text-text-muted">자동 적용할 수 있는 서비스가 없습니다.</p>
              <p className="mx-auto max-w-sm text-xs text-text-dim">
                Compose로 실행 중인 Java 또는 Node.js 서비스가 대상입니다. 나머지 서비스는 eBPF 기본 모니터링을 계속 사용할 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-4">
                <div className="flex items-start gap-2.5">
                  <MaterialIcon name="verified_user" className="mt-0.5 shrink-0 text-lg text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold text-text-base">원본 Compose는 수정하지 않습니다</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      CLI가 별도 override를 만들고 선택한 서비스만 재시작합니다. 주입 옵션, 공유 볼륨, 네트워크와 컨테이너 상태를 확인하며 실패하면 직전 설정으로 자동 복구합니다.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-dim">적용 대상</p>
                <div className="flex flex-wrap gap-1.5">
                  {targets.map((target) => (
                    <span
                      key={target.composeService}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                    >
                      {target.name}
                      <span className="opacity-70">· {runtimeLabel(target.runtime)}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className={`grid gap-3 ${composeProjects.length > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {composeProjects.length > 1 && (
                  <div className="space-y-1.5">
                    <label htmlFor="otel-compose-project" className="text-xs font-semibold text-text-muted">
                      Compose 프로젝트
                    </label>
                    <Select
                      id="otel-compose-project"
                      value={selectedProject}
                      onChange={(event) => setComposeProject(event.target.value)}
                    >
                      {composeProjects.map((project) => (
                        <option key={project} value={project}>{project}</option>
                      ))}
                    </Select>
                    <p className="text-xs text-text-dim">한 번에 한 Compose 프로젝트씩 적용합니다.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="otel-web-base-url" className="text-xs font-semibold text-text-muted">
                    모니터링 서버 주소
                  </label>
                  <Input
                    id="otel-web-base-url"
                    type="url"
                    value={webBaseUrl}
                    onChange={(event) => setWebBaseUrl(event.target.value)}
                    placeholder="예: http://192.168.0.10:3001"
                    warn={webAddressMissing}
                  />
                  <p className={`text-xs ${webAddressMissing ? 'text-amber-600 dark:text-amber-400' : 'text-text-dim'}`}>
                    {webAddressMissing ? '애플리케이션 서버에서 접근 가능한 주소를 입력하세요.' : 'CLI를 최신 버전으로 내려받을 주소입니다.'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="otel-compose-path" className="text-xs font-semibold text-text-muted">
                    애플리케이션 Compose 경로
                  </label>
                  <Input
                    id="otel-compose-path"
                    type="text"
                    value={composePath}
                    onChange={(event) => setComposePath(event.target.value)}
                    placeholder="./docker-compose.yml"
                    mono warn={composePathMissing}
                  />
                  <p className="text-xs text-text-dim">이 명령을 실행할 서버의 파일 경로입니다.</p>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ui-border p-3 transition-colors hover:bg-ui-hover-soft">
                <input
                  type="checkbox"
                  checked={captureBodies}
                  onChange={(event) => setCaptureBodies(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-base">요청·응답 바디도 수집</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    Node.js만 지원하며 민감 필드를 마스킹하고 크기를 제한합니다.
                    {hasJava && captureBodies && ' Java 서비스에는 헤더 수집만 적용됩니다.'}
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-text-base">안전 적용 명령</p>
                    <p className="mt-0.5 text-xs text-text-muted">애플리케이션 Compose가 있는 Linux 서버에서 실행하세요.</p>
                  </div>
                  <CopyButton
                    onCopy={() => copy(applyCommand)}
                    title={webAddressMissing || composePathMissing ? '주소와 Compose 경로를 입력하세요' : '안전 적용 명령 복사'}
                    disabled={webAddressMissing || composePathMissing}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    iconClassName="text-base"
                  >
                    <span>복사</span>
                  </CopyButton>
                </div>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-900 px-4 py-3 font-mono text-xs text-slate-100 dark:bg-black">
                  {applyCommand}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">적용 후 관리</p>
                <CommandRow label="상태 확인" command={statusCommand} onCopy={copy} />
                <CommandRow label="다시 검증" command={verifyCommand} onCopy={copy} />
                <CommandRow label="직전 설정으로 되돌리기" command={rollbackCommand} onCopy={copy} />
              </div>

              <div className="space-y-1 border-t border-ui-border-soft pt-3">
                {skipped.length > 0 && (
                  <p className="text-xs text-text-dim">
                    제외됨(Compose 관리 대상 아님): {skipped.map((service) => service.name).join(', ')}
                  </p>
                )}
                <p className="text-xs text-text-dim">
                  Authorization, Cookie 등 민감 헤더는 서버에서 자동 마스킹됩니다.{' '}
                  <a href={DOC_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    상세 계측 문서
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
