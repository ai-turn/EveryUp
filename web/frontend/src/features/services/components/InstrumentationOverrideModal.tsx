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

// Compose-managed services carry a "project:service" key (see the agent's
// stableServiceKey); only those can be targeted by a compose override.
function composeServiceOf(key: string): string | null {
  const idx = key.indexOf(':');
  return idx > 0 ? key.slice(idx + 1) : null;
}

function envLines(runtime: string): string[] {
  const shared = [
    '      OTEL_EXPORTER_OTLP_ENDPOINT: "http://everyup-agent:4318"',
    '      OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf"',
  ];
  if (runtime === 'java') {
    return [
      '      # 주의: 앱이 JAVA_TOOL_OPTIONS를 이미 쓰고 있다면 기존 값 뒤에 이어 붙이세요.',
      '      JAVA_TOOL_OPTIONS: "-javaagent:/everyup/java/opentelemetry-javaagent.jar"',
      ...shared,
      '      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS: "content-type,user-agent,accept"',
      '      OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_RESPONSE_HEADERS: "content-type"',
    ];
  }
  return [
    '      NODE_OPTIONS: "--require /everyup/node/register.js"',
    ...shared,
    '      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST: "content-type,user-agent,accept"',
    '      OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_RESPONSE: "content-type"',
    '      # 바디 수집(선택): 앱 안에서 마스킹·8KiB 절단 후 전송됩니다.',
    '      # EVERYUP_CAPTURE_BODIES: "true"',
  ];
}

function buildOverride(targets: { composeService: string; runtime: string }[]): string {
  const blocks = targets.map(({ composeService, runtime }) => [
    `  ${composeService}:`,
    '    volumes: ["everyup-instrumentation:/everyup:ro"]',
    '    environment:',
    ...envLines(runtime),
  ].join('\n'));

  return [
    '# docker-compose.everyup.yml — 앱 compose 파일 옆에 저장한 뒤:',
    '#   docker compose -f <앱-compose>.yml -f docker-compose.everyup.yml up -d',
    'volumes:',
    '  everyup-instrumentation:',
    '    external: true',
    '',
    'services:',
    ...blocks,
    '',
  ].join('\n');
}

export function InstrumentationOverrideModal({ agentId, onClose }: Props) {
  const { copy } = useClipboardCopy();
  const [services, setServices] = useState<AgentServiceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

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
  const yaml = buildOverride(targets);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="OTel instrumentation override"
    >
      <div className="bg-white dark:bg-bg-surface-dark shadow-2xl w-full max-w-3xl h-full max-h-full flex flex-col sm:h-auto sm:max-h-[85vh] sm:rounded-xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-ui-border-dark">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
            <MaterialIcon name="integration_instructions" className="text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">OTel 계측 설정 (헤더·바디)</h3>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
              감지된 런타임 기반으로 생성된 compose override — 코드·Dockerfile 수정 없이 재시작 1회
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Close"
          >
            <MaterialIcon name="close" className="text-base" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="h-40 bg-slate-100 dark:bg-ui-hover-dark rounded-xl animate-pulse" />
          ) : targets.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400 dark:text-text-muted-dark">
              주입 가능한 서비스가 없습니다 — Java/Node 런타임이 감지된 compose 서비스가 대상입니다.
              (Go 서비스는 eBPF 사이드카가 코드 없이 커버합니다.)
            </p>
          ) : (
            <>
              <ol className="space-y-1.5 text-sm text-slate-600 dark:text-text-muted-dark list-decimal list-inside">
                <li>
                  에이전트 compose에서 <code className="font-mono text-xs bg-slate-100 dark:bg-ui-hover-dark px-1 py-0.5 rounded">everyup-instrumentation</code> 볼륨
                  두 줄의 주석을 해제하고 에이전트를 재기동 (계측 번들이 볼륨에 채워집니다)
                </li>
                <li>아래 파일을 앱 compose 옆에 <code className="font-mono text-xs bg-slate-100 dark:bg-ui-hover-dark px-1 py-0.5 rounded">docker-compose.everyup.yml</code>로 저장</li>
                <li>
                  <code className="font-mono text-xs bg-slate-100 dark:bg-ui-hover-dark px-1 py-0.5 rounded">
                    docker compose -f &lt;앱-compose&gt;.yml -f docker-compose.everyup.yml up -d
                  </code>
                </li>
              </ol>

              <div className="flex flex-wrap gap-1.5">
                {targets.map((t) => (
                  <span key={t.composeService} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {t.name}
                    <span className="opacity-70">· {runtimeLabel(t.runtime)}</span>
                  </span>
                ))}
              </div>

              <div className="relative">
                <pre className="max-h-96 overflow-auto rounded-xl border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark p-4 font-mono text-xs text-slate-700 dark:text-text-base-dark whitespace-pre">{yaml}</pre>
                <CopyButton
                  onCopy={() => copy(yaml)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark text-slate-500 hover:text-primary cursor-pointer"
                  title="Copy override"
                  iconClassName="text-base"
                />
              </div>

              {skipped.length > 0 && (
                <p className="text-xs text-slate-400 dark:text-text-dim-dark">
                  제외됨 (compose로 관리되지 않는 컨테이너): {skipped.map((s) => s.name).join(', ')}
                </p>
              )}
              <p className="text-xs text-slate-400 dark:text-text-dim-dark">
                민감 헤더(authorization, cookie 등)는 수집 목록과 무관하게 서버에서 마스킹됩니다.
                바디 열람은 admin 전용이며 감사 로그가 남습니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
