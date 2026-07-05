import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CopyButton, MaterialIcon } from '../../../components/common';
import { useClipboardCopy } from '../../../hooks/useClipboardCopy';
import { getErrorMessage } from '../../../utils/errors';
import { api, TraceDetail, TraceSpan, LogEntry, ApiRequest } from '../../../services/api';

interface TracePanelProps {
  traceId: string;
  onClose: () => void;
}

// Returns the log-service detail path for a given serviceId. Cross-jump only
// renders when the panel is opened from within a service context.
function logServicePath(serviceId: string, tab: 'logs' | 'requests', traceId: string): string {
  return `/logs/${serviceId}?tab=${tab}&traceId=${encodeURIComponent(traceId)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
}

function spanKindBadge(kind: string): string {
  switch (kind) {
    case 'SERVER':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'CLIENT':   return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'PRODUCER':
    case 'CONSUMER': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'INTERNAL': return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
    default:         return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
}

function statusBadge(code: string | undefined): string {
  if (code === 'ERROR') return 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (code === 'OK')    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
}

function logLevelBadge(level: string): string {
  switch (level) {
    case 'error': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    case 'warn':  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'info':  return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'debug': return 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
    case 'trace': return 'bg-slate-500/10 text-slate-400 dark:text-slate-500';
    default:      return 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
  }
}

type CopyFn = (text: string) => Promise<boolean>;

function copyButton(onCopy: () => Promise<boolean>, label: string) {
  return (
    <CopyButton
      onCopy={onCopy}
      className="ml-auto shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-ui-active-dark dark:hover:text-slate-200"
      title={label}
      iconClassName="text-sm"
    />
  );
}

function formatSpanCopy(span: TraceSpan): string {
  return [
    `kind=${span.kind}`,
    `name=${span.name || '(unnamed)'}`,
    span.serviceName ? `service=${span.serviceName}` : null,
    span.statusCode && span.statusCode !== 'UNSET' ? `status=${span.statusCode}` : null,
    `duration=${formatDuration(span.durationMs)}`,
    `traceId=${span.traceId}`,
    `spanId=${span.spanId}`,
  ].filter(Boolean).join(' ');
}

function formatApiRequestCopy(req: ApiRequest): string {
  return [
    `method=${req.method}`,
    `path=${req.path}`,
    `status=${req.statusCode}`,
    `duration=${formatDuration(req.durationMs)}`,
    req.serviceName ? `service=${req.serviceName}` : null,
    req.traceId ? `traceId=${req.traceId}` : null,
    req.spanId ? `spanId=${req.spanId}` : null,
  ].filter(Boolean).join(' ');
}

function formatLogCopy(log: LogEntry): string {
  return [
    `time=${log.createdAt}`,
    `level=${log.level}`,
    `message=${log.message}`,
    log.serviceName ? `service=${log.serviceName}` : null,
    log.traceId ? `traceId=${log.traceId}` : null,
    log.spanId ? `spanId=${log.spanId}` : null,
  ].filter(Boolean).join(' ');
}

interface CapturedBody {
  id: string;
  label: string;
  body: string;
  spanName: string;
  serviceName?: string;
  size?: number;
  truncated?: boolean;
}

function attrString(attrs: Record<string, unknown> | undefined, key: string): string {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : '';
}

function attrNumber(attrs: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = attrs?.[key];
  return typeof value === 'number' ? value : undefined;
}

function attrBool(attrs: Record<string, unknown> | undefined, key: string): boolean {
  return attrs?.[key] === true;
}

function capturedBodyLabel(eventName: string): string {
  if (eventName === 'request_body_masked') return 'Request';
  if (eventName === 'response_body_masked') return 'Response';
  return 'Body';
}

function extractCapturedBodies(spans: TraceSpan[]): CapturedBody[] {
  return spans.flatMap((span) =>
    (span.events ?? [])
      .filter((event) => event.name === 'request_body_masked' || event.name === 'response_body_masked')
      .map((event) => ({
        id: `${span.traceId}-${span.spanId}-${event.name}-${event.timeUnixNano ?? 0}`,
        label: capturedBodyLabel(event.name),
        body: attrString(event.attributes, 'body'),
        spanName: span.name || '(unnamed)',
        serviceName: span.serviceName,
        size: attrNumber(event.attributes, 'body_size'),
        truncated: attrBool(event.attributes, 'body_truncated'),
      }))
      .filter((item) => item.body !== ''),
  );
}

function formatCapturedBodyCopy(item: CapturedBody): string {
  return [
    `${item.label.toLowerCase()} body`,
    item.serviceName ? `service=${item.serviceName}` : null,
    `span=${item.spanName}`,
    item.truncated ? 'truncated=true' : null,
    item.body,
  ].filter(Boolean).join('\n');
}

interface HeaderEntry {
  name: string;
  value: string;
}

interface CapturedHeaders {
  id: string;
  spanName: string;
  serviceName?: string;
  request: HeaderEntry[];
  response: HeaderEntry[];
}

// OTel captures headers as `http.request.header.<name>` / `http.response.header.<name>`
// span attributes; values are arrays of strings per semconv. Sensitive names
// arrive already masked ("***") from ingest.
function headerValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value ?? '');
}

function extractCapturedHeaders(spans: TraceSpan[]): CapturedHeaders[] {
  const out: CapturedHeaders[] = [];
  for (const span of spans) {
    const request: HeaderEntry[] = [];
    const response: HeaderEntry[] = [];
    for (const [key, value] of Object.entries(span.attributes ?? {})) {
      if (key.startsWith('http.request.header.')) {
        request.push({ name: key.slice('http.request.header.'.length), value: headerValue(value) });
      } else if (key.startsWith('http.response.header.')) {
        response.push({ name: key.slice('http.response.header.'.length), value: headerValue(value) });
      }
    }
    if (request.length === 0 && response.length === 0) continue;
    request.sort((a, b) => a.name.localeCompare(b.name));
    response.sort((a, b) => a.name.localeCompare(b.name));
    out.push({
      id: `${span.traceId}-${span.spanId}-headers`,
      spanName: span.name || '(unnamed)',
      serviceName: span.serviceName,
      request,
      response,
    });
  }
  return out;
}

function formatCapturedHeadersCopy(item: CapturedHeaders): string {
  const lines = [item.serviceName ? `service=${item.serviceName}` : null, `span=${item.spanName}`];
  if (item.request.length > 0) {
    lines.push('[request headers]', ...item.request.map((h) => `${h.name}: ${h.value}`));
  }
  if (item.response.length > 0) {
    lines.push('[response headers]', ...item.response.map((h) => `${h.name}: ${h.value}`));
  }
  return lines.filter(Boolean).join('\n');
}

export function TracePanel({ traceId, onClose }: TracePanelProps) {
  const { copy } = useClipboardCopy();
  const { t } = useTranslation('logs');
  const navigate = useNavigate();
  const { serviceId } = useParams<{ serviceId: string }>();
  const [data, setData] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jumpTo = (tab: 'logs' | 'requests') => {
    if (!serviceId) return;
    onClose();
    navigate(logServicePath(serviceId, tab, traceId));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getTrace(traceId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [traceId]);

  const spans = data?.spans ?? [];
  const logs = data?.logs ?? [];
  const apiRequests = data?.apiRequests ?? [];
  const capturedBodies = extractCapturedBodies(spans);
  const capturedHeaders = extractCapturedHeaders(spans);
  const isEmpty = !loading && !error && spans.length === 0 && logs.length === 0 && apiRequests.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trace detail"
    >
      <div className="bg-white dark:bg-bg-surface-dark shadow-2xl w-full max-w-3xl h-full max-h-full flex flex-col sm:h-auto sm:max-h-[85vh] sm:rounded-xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-ui-border-dark">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
            <MaterialIcon name="timeline" className="text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Trace</h3>
            <div className="flex items-center gap-1 mt-0.5 min-w-0">
              <code className="text-xs font-mono text-slate-500 dark:text-text-muted-dark break-all min-w-0">
                {traceId}
              </code>
              <CopyButton
                onCopy={() => copy(traceId)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                title="Copy trace ID"
                iconClassName="text-sm"
              />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Close"
          >
            <MaterialIcon name="close" className="text-base" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-slate-500 dark:text-text-muted-dark">
              <MaterialIcon name="sync" className="text-base mr-2 animate-spin" />
              Loading trace...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/30">
              <MaterialIcon name="error" className="text-sm text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {isEmpty && (
            <div className="text-center py-10 text-sm text-slate-500 dark:text-text-muted-dark">
              No spans, logs, or API requests for this trace.
            </div>
          )}

          {!loading && !error && serviceId && (logs.length > 0 || apiRequests.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-500 dark:text-text-muted-dark mr-1">
                {t('apiRequests.tracePanel.jumpTo')}
              </span>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpTo('logs')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <MaterialIcon name="article" className="text-sm" />
                  {t('apiRequests.tracePanel.openInLogs', { count: logs.length })}
                </button>
              )}
              {apiRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpTo('requests')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <MaterialIcon name="http" className="text-sm" />
                  {t('apiRequests.tracePanel.openInRequests', { count: apiRequests.length })}
                </button>
              )}
            </div>
          )}

          {!loading && !error && spans.length > 0 && (
            <SpanList spans={spans} onCopy={copy} />
          )}
          {!loading && !error && capturedHeaders.length > 0 && (
            <CapturedHeadersList items={capturedHeaders} onCopy={copy} />
          )}
          {!loading && !error && capturedBodies.length > 0 && (
            <CapturedBodyList items={capturedBodies} onCopy={copy} />
          )}
          {!loading && !error && apiRequests.length > 0 && (
            <ApiRequestList items={apiRequests} onCopy={copy} />
          )}
          {!loading && !error && logs.length > 0 && (
            <LogList logs={logs} onCopy={copy} />
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count }: { icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <MaterialIcon name={icon} className="text-base text-primary" />
      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h4>
      <span className="text-xs font-semibold text-slate-400 dark:text-text-dim-dark bg-slate-100 dark:bg-ui-active-dark px-2 py-0.5 rounded-md">
        {count}
      </span>
    </div>
  );
}

function SpanList({ spans, onCopy }: { spans: TraceSpan[]; onCopy: CopyFn }) {
  return (
    <section>
      <SectionHeader icon="account_tree" title="Spans" count={spans.length} />
      <ul className="space-y-1.5">
        {spans.map((span) => (
          <li
            key={`${span.traceId}-${span.spanId}`}
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark border border-slate-100 dark:border-ui-border-dark text-sm sm:flex-nowrap"
          >
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${spanKindBadge(span.kind)}`}>
              {span.kind}
            </span>
            <span className="font-mono text-slate-700 dark:text-text-base-dark truncate flex-1 min-w-0" title={span.name}>
              {span.name || '(unnamed)'}
            </span>
            {span.serviceName && (
              <span className="text-slate-500 dark:text-text-muted-dark shrink-0">
                {span.serviceName}
              </span>
            )}
            {span.statusCode && span.statusCode !== 'UNSET' && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${statusBadge(span.statusCode)}`}>
                {span.statusCode}
              </span>
            )}
            <span className="text-slate-500 dark:text-text-muted-dark font-mono shrink-0">
              {formatDuration(span.durationMs)}
            </span>
            {copyButton(() => onCopy(formatSpanCopy(span)), 'Copy span row')}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HeaderRows({ label, headers }: { label: string; headers: HeaderEntry[] }) {
  if (headers.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-text-dim-dark">{label}</p>
      <dl className="space-y-0.5">
        {headers.map((h) => (
          <div key={h.name} className="flex gap-2 font-mono text-xs">
            <dt className="shrink-0 text-slate-500 dark:text-text-muted-dark">{h.name}:</dt>
            <dd className={`min-w-0 break-all ${h.value === '***' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-text-base-dark'}`}>
              {h.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CapturedHeadersList({ items, onCopy }: { items: CapturedHeaders[]; onCopy: CopyFn }) {
  return (
    <section>
      <SectionHeader icon="list_alt" title="Headers" count={items.length} />
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-ui-border-dark dark:bg-ui-hover-dark"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {item.serviceName && (
                <span className="text-slate-500 dark:text-text-muted-dark">{item.serviceName}</span>
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-slate-500 dark:text-text-muted-dark" title={item.spanName}>
                {item.spanName}
              </span>
              {copyButton(() => onCopy(formatCapturedHeadersCopy(item)), 'Copy headers')}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <HeaderRows label="Request" headers={item.request} />
              <HeaderRows label="Response" headers={item.response} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CapturedBodyList({ items, onCopy }: { items: CapturedBody[]; onCopy: CopyFn }) {
  return (
    <section>
      <SectionHeader icon="data_object" title="Captured bodies" count={items.length} />
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-ui-border-dark dark:bg-ui-hover-dark"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                {item.label}
              </span>
              {item.serviceName && (
                <span className="text-slate-500 dark:text-text-muted-dark">
                  {item.serviceName}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-slate-500 dark:text-text-muted-dark" title={item.spanName}>
                {item.spanName}
              </span>
              {typeof item.size === 'number' && (
                <span className="font-mono text-xs text-slate-400 dark:text-text-dim-dark">
                  {item.size}B
                </span>
              )}
              {item.truncated && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  truncated
                </span>
              )}
              {copyButton(() => onCopy(formatCapturedBodyCopy(item)), 'Copy captured body')}
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-2 font-mono text-xs text-slate-700 dark:border-ui-border-dark dark:bg-bg-surface-dark dark:text-text-base-dark">{item.body}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApiRequestList({ items, onCopy }: { items: ApiRequest[]; onCopy: CopyFn }) {
  return (
    <section>
      <SectionHeader icon="api" title="API requests" count={items.length} />
      <ul className="space-y-1.5">
        {items.map((req) => (
          <li
            key={req.id}
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark border border-slate-100 dark:border-ui-border-dark text-sm sm:flex-nowrap"
          >
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-slate-200 dark:bg-ui-active-dark text-slate-700 dark:text-text-base-dark shrink-0">
              {req.method}
            </span>
            <span className="font-mono text-slate-700 dark:text-text-base-dark truncate flex-1 min-w-0" title={req.path}>
              {req.path}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${
              req.isError
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {req.statusCode}
            </span>
            <span className="text-slate-500 dark:text-text-muted-dark font-mono shrink-0">
              {formatDuration(req.durationMs)}
            </span>
            {copyButton(() => onCopy(formatApiRequestCopy(req)), 'Copy API request row')}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LogList({ logs, onCopy }: { logs: LogEntry[]; onCopy: CopyFn }) {
  return (
    <section>
      <SectionHeader icon="article" title="Logs" count={logs.length} />
      <ul className="space-y-1.5">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark border border-slate-100 dark:border-ui-border-dark text-sm"
          >
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${logLevelBadge(log.level)}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-slate-500 dark:text-text-muted-dark font-mono shrink-0 mt-0.5">
              {formatTime(log.createdAt)}
            </span>
            <span className="text-slate-700 dark:text-text-base-dark break-all flex-1 min-w-0">
              {log.message}
            </span>
            {copyButton(() => onCopy(formatLogCopy(log)), 'Copy log row')}
          </li>
        ))}
      </ul>
    </section>
  );
}
