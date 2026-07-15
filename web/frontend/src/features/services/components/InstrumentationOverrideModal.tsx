import { useEffect, useState } from 'react';
import { MaterialIcon, CopyButton } from '../../../components/common';
import { useClipboardCopy } from '../../../hooks/useClipboardCopy';
import { api, type AgentServiceSnapshot } from '../../../services/api';
import { runtimeLabel } from '../../healthcheck/runtimeLabels';

interface Props {
  agentId: string;
  onClose: () => void;
}

// Runtimes the bundled instrumentation can inject via env vars alone.
const INJECTABLE = new Set(['java', 'node']);

const DOC_URL = 'https://github.com/ai-turn/everyup/blob/main/docs/OTEL_API_INSTRUMENTATION.ko.md';

// Compose-managed services carry a "project:service" key (see the agent's
// stableServiceKey); only those can be targeted by a compose override.
function composeServiceOf(key: string): string | null {
  const idx = key.indexOf(':');
  return idx > 0 ? key.slice(idx + 1) : null;
}

function envLines(runtime: string, captureBodies: boolean): string[] {
  const shared = [
    '      OTEL_EXPORTER_OTLP_ENDPOINT: "http://everyup-agent:4318"',
    '      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf"',
  ];
  if (runtime === 'java') {
    // Java bodies need a code-side filter (see the doc), so the toggle only
    // affects Node here — Java blocks stay headers-only.
    return [
      '      # 앱이 JAVA_TOOL_OPTIONS를 이미 쓰면 기존 값 뒤에 이어 붙이세요',
      '      JAVA_TOOL_OPTIONS: "-javaagent:/everyup/java/opentelemetry-javaagent.jar"',
      ...shared,
      '      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS: "content-type,user-agent,accept"',
      '      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS: "content-type"',
    ];
  }
  const node = [
    '      NODE_OPTIONS: "--require /everyup/node/register.js"',
    ...shared,
    '      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST: "content-type,user-agent,accept"',
    '      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_RESPONSE: "content-type"',
  ];
  if (captureBodies) {
    node.push('      EVERYUP_CAPTURE_BODIES: "true"   # 바디: 앱 안에서 마스킹·8KiB 절단 후 전송');
  }
  return node;
}

function buildOverride(targets: { composeService: string; runtime: string }[], captureBodies: boolean): string {
  const blocks = targets.map(({ composeService, runtime }) => [
    `  ${composeService}:`,
    '    volumes: ["everyup-instrumentation:/everyup:ro"]',
    '    environment:',
    ...envLines(runtime, captureBodies),
  ].join('\n'));

  return [
    'volumes:',
    '  everyup-instrumentation:',
    '    external: true',
    '',
    'services:',
    ...blocks,
    '',
  ].join('\n');
}

// One labeled file in the "3 files on this server" mental map.
function FileRow({ icon, name, note, tone }: { icon: string; name: string; note: string; tone: 'new' | 'edit' | 'keep' }) {
  const toneCls = {
    new: 'text-primary',
    edit: 'text-text-muted',
    keep: 'text-text-dim',
  }[tone];
  return (
    <div className="flex items-start gap-2 text-sm">
      <MaterialIcon name={icon} className={`text-base mt-0.5 shrink-0 ${toneCls}`} />
      <div className="min-w-0">
        <code className="font-mono text-xs text-text-secondary">{name}</code>
        <span className="text-text-muted"> — {note}</span>
      </div>
    </div>
  );
}

export function InstrumentationOverrideModal({ agentId, onClose }: Props) {
  const { copy } = useClipboardCopy();
  const [services, setServices] = useState<AgentServiceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [captureBodies, setCaptureBodies] = useState(false);

  useEffect(() => {
    api.getAgentServices(agentId)
      .then((list) => setServices(list ?? []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [agentId]);

  const targets = services
    .filter((s) => s.runtime && INJECTABLE.has(s.runtime))
    .flatMap((s) => {
      const composeService = composeServiceOf(s.key);
      return composeService ? [{ composeService, runtime: s.runtime!, name: s.name }] : [];
    });
  const skipped = services.filter(
    (s) => s.runtime && INJECTABLE.has(s.runtime) && !composeServiceOf(s.key),
  );
  const yaml = buildOverride(targets, captureBodies);
  const hasJava = targets.some((t) => t.runtime === 'java');

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="OTel instrumentation override"
    >
      <div className="bg-bg-surface shadow-2xl w-full max-w-2xl h-full max-h-full flex flex-col sm:h-auto sm:max-h-[88vh] sm:rounded-xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ui-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
            <MaterialIcon name="integration_instructions" className="text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-base">API 헤더·바디 수집 설정</h3>
            <p className="text-xs text-text-muted mt-0.5">
              앱 코드·Dockerfile 수정 없이, 재시작 한 번으로 이 프로젝트의 요청/응답 헤더·바디를 수집합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-ui-hover text-slate-400 hover:text-text-secondary cursor-pointer"
            aria-label="Close"
          >
            <MaterialIcon name="close" className="text-base" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="h-40 bg-ui-hover rounded-xl animate-pulse" />
          ) : targets.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <MaterialIcon name="info" className="text-3xl text-text-dim" />
              <p className="text-sm text-text-muted">
                주입 가능한 서비스가 없습니다.
              </p>
              <p className="text-xs text-text-dim max-w-sm mx-auto">
                Java·Node.js 런타임이 감지된 compose 서비스가 대상입니다. Go 서비스는 코드 없이
                eBPF 사이드카가 커버하고, 그 외 런타임은{' '}
                <a href={DOC_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">문서의 수동 계측</a>을 참고하세요.
              </p>
            </div>
          ) : (
            <>
              {/* What this targets */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-1.5">대상 서비스</p>
                <div className="flex flex-wrap gap-1.5">
                  {targets.map((t) => (
                    <span key={t.composeService} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {t.name}
                      <span className="opacity-70">· {runtimeLabel(t.runtime)}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Body capture toggle — reflects into the YAML below */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-ui-border cursor-pointer hover:bg-ui-hover-soft transition-colors">
                <input
                  type="checkbox"
                  checked={captureBodies}
                  onChange={(e) => setCaptureBodies(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text-base">요청/응답 바디도 수집</span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    헤더는 항상 포함됩니다. 바디는 앱 안에서 마스킹·절단 후 전송되며 열람은 admin 전용입니다.
                    {hasJava && captureBodies && (
                      <> (Java 바디는 코드 필터가 추가로 필요 —{' '}
                        <a href={DOC_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>문서</a> 참고)</>
                    )}
                  </span>
                </span>
              </label>

              {/* The deliverable — the override file, front and center */}
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <p className="text-sm font-bold text-text-base">
                    붙여넣을 override <code className="font-mono text-xs bg-ui-hover px-1 py-0.5 rounded">docker-compose.everyup.yml</code>
                  </p>
                </div>
                <p className="text-xs text-text-muted mb-2">
                  앱 컨테이너에 계측을 주입합니다 — 앱 이미지·코드는 그대로 두고 env와 볼륨만 얹습니다.
                </p>
                <div className="relative">
                  <pre className="max-h-80 overflow-auto rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary whitespace-pre">{yaml}</pre>
                  <CopyButton
                    onCopy={() => copy(yaml)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-bg-surface border border-ui-border text-slate-500 hover:text-primary cursor-pointer"
                    title="Copy override"
                    iconClassName="text-base"
                  />
                </div>
              </div>

              {/* File map — the 3 files and what happens to each, all on the monitored server */}
              <div className="rounded-xl bg-ui-hover-soft p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-1">이 서버의 파일 3개</p>
                <FileRow icon="add_circle" tone="new" name="docker-compose.everyup.yml" note="위 내용을 새 파일로 저장 (신규)" />
                <FileRow icon="edit" tone="edit" name="에이전트 compose" note="계측 볼륨 활성화, 최초 1회 (아래 사전 준비)" />
                <FileRow icon="check_circle" tone="keep" name="앱 compose (기존)" note="수정 없음 — 실행할 때 함께 지정만" />
              </div>

              {/* How to apply — prereq first (agent-side, once), then this-service steps */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-text-base">적용하기</p>

                <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-3">
                  <p className="text-xs font-bold text-text-secondary mb-1 flex items-center gap-1.5">
                    <MaterialIcon name="schedule" className="text-sm text-text-dim" /> 사전 준비 · 에이전트 쪽 · 최초 1회
                  </p>
                  <p className="text-xs text-text-muted">
                    에이전트 compose에서 <code className="font-mono bg-bg-surface px-1 rounded">everyup-instrumentation</code> 볼륨
                    두 줄(에이전트 마운트 + volumes 정의)의 주석을 해제하고 에이전트를 재기동하세요.
                    계측 번들을 앱과 공유할 볼륨을 켜는 단계이며, 이미 켰다면 넘어가세요.
                  </p>
                </div>

                <ol className="space-y-2 text-sm text-text-muted">
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                    <span>위 YAML을 앱 compose 옆에 <code className="font-mono text-xs bg-ui-hover px-1 py-0.5 rounded">docker-compose.everyup.yml</code>로 저장</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                    <span>
                      두 파일을 함께 지정해 재시작:
                      <code className="block mt-1 font-mono text-xs bg-ui-hover px-2 py-1 rounded overflow-x-auto">docker compose -f &lt;앱-compose&gt;.yml -f docker-compose.everyup.yml up -d</code>
                    </span>
                  </li>
                </ol>
              </div>

              {/* Footnotes */}
              <div className="space-y-1 border-t border-ui-border-soft pt-3">
                {skipped.length > 0 && (
                  <p className="text-xs text-text-dim">
                    제외됨 (compose로 관리되지 않는 컨테이너): {skipped.map((s) => s.name).join(', ')}
                  </p>
                )}
                <p className="text-xs text-text-dim">
                  민감 헤더(authorization, cookie 등)는 수집 목록과 무관하게 서버에서 자동 마스킹됩니다.
                </p>
                <p className="text-xs text-text-dim">
                  언어별 계측·스팬 계약 자세히:{' '}
                  <a href={DOC_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">API 헤더·바디 수집 문서</a>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
