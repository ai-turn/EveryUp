import { toast } from 'react-hot-toast';
import { Button, CopyButton, MaterialIcon } from '../../../components/common';
import { env } from '../../../config/env';
import { copyTextToClipboard } from '../../../hooks/useClipboardCopy';
import type { InfrastructureResourceSetup } from '../../../services/api';

function copy(value: string) {
  return copyTextToClipboard(value).then(() => true).catch(() => {
    toast.error('복사하지 못했습니다. 내용을 직접 선택해 복사해 주세요.');
    return false;
  });
}

function collectorConfig(setup: InfrastructureResourceSetup) {
  const endpoint = `${env.apiBaseUrl.replace(/\/+$/, '')}/otlp`;
  return [
    'receivers:',
    '  host_metrics:',
    '    collection_interval: 30s',
    '    scrapers:',
    '      cpu:',
    '        metrics:',
    '          system.cpu.utilization:',
    '            enabled: true',
    '      memory:',
    '      filesystem:',
    '      disk:',
    '      network:',
    'processors:',
    '  batch:',
    'exporters:',
    '  otlphttp/everyup:',
    `    endpoint: ${endpoint}`,
    '    headers:',
    `      Authorization: "Bearer ${setup.apiKey}"`,
    'service:',
    '  pipelines:',
    '    metrics:',
    '      receivers: [host_metrics]',
    '      processors: [batch]',
    '      exporters: [otlphttp/everyup]',
  ].join('\n');
}

export function InfrastructureCollectorSetupResult({
  setup,
  title,
  onDone,
}: {
  setup: InfrastructureResourceSetup;
  title: string;
  onDone: () => void;
}) {
  const config = collectorConfig(setup);
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-healthy/10 text-status-healthy"><MaterialIcon name="check" /></span>
        <div>
          <h3 className="text-lg text-text-base">{title}</h3>
          <p className="mt-1 text-sm text-text-muted">Collector API 키는 지금 한 번만 표시됩니다. 안전한 곳에 저장해 주세요.</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-secondary">Collector API 키</p>
        <div className="flex items-center gap-2 rounded-xl border border-ui-border bg-ui-hover-soft p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-base">{setup.apiKey}</code>
          <CopyButton onCopy={() => copy(setup.apiKey)} title="API 키 복사" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-ui-hover" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-text-secondary">otelcol-contrib.yaml</p>
          <CopyButton onCopy={() => copy(config)} title="Collector 설정 복사" className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10">복사</CopyButton>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre rounded-xl border border-ui-border bg-ui-hover-soft p-4 font-mono text-xs text-text-secondary">{config}</pre>
      </div>
      <div className="rounded-xl border border-ui-border bg-ui-hover-soft p-4 text-xs text-text-muted">
        <p className="font-semibold text-text-secondary">실행</p>
        <code className="mt-2 block break-all font-mono">otelcol-contrib --config otelcol-contrib.yaml</code>
      </div>
      <div className="flex justify-end border-t border-ui-border pt-4"><Button onClick={onDone}>인프라 보기</Button></div>
    </div>
  );
}
