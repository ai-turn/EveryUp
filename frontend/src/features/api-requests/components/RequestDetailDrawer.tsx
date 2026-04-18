import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import type { ApiRequest } from '../../../services/api';

export interface RequestDetailDrawerProps {
  request: ApiRequest;
  onClose?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'POST':   return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'PUT':
    case 'PATCH':  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'DELETE': return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:       return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
}

function getStatusBadgeClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (statusCode >= 300 && statusCode < 400) return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
  if (statusCode >= 400 && statusCode < 500) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (statusCode >= 500)                     return 'bg-red-500/10 text-red-600 dark:text-red-400';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year:   'numeric',
    month:  'short',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function isMasked(value: string): boolean {
  return value === '***';
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
      {children}
    </p>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { copy } = useCopyToClipboard();
  return (
    <button
      onClick={() => copy(value)}
      title={label ?? 'Copy'}
      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-400 dark:text-text-dim-dark shrink-0"
    >
      <MaterialIcon name="content_copy" className="text-sm" />
    </button>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-text-dim-dark">{label}</span>
      <span className="text-xs text-slate-700 dark:text-text-secondary-dark">{value}</span>
    </div>
  );
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-text-dim-dark italic">No headers</p>;
  }
  return (
    <div className="rounded-lg border border-slate-200 dark:border-ui-border-dark overflow-hidden">
      <table className="w-full text-xs font-mono">
        <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
          {entries.map(([key, value]) => (
            <tr key={key} className="align-top">
              <td className="px-3 py-1.5 bg-slate-50 dark:bg-ui-hover-dark/40 text-slate-600 dark:text-text-muted-dark whitespace-nowrap w-px max-w-50 truncate" title={key}>
                {key}
              </td>
              <td className={`px-3 py-1.5 break-all ${isMasked(value) ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BodyBlock({ body, bodySize }: { body: string | undefined; bodySize: number }) {
  if (!body) {
    return <p className="text-xs text-slate-400 dark:text-text-dim-dark italic">No body</p>;
  }

  const isTruncated = bodySize > body.length;

  let rendered: string;
  let isPretty = false;
  try {
    const parsed = JSON.parse(body) as unknown;
    rendered = JSON.stringify(parsed, null, 2);
    isPretty = true;
  } catch {
    rendered = body;
  }

  return (
    <div className="flex flex-col gap-2">
      {isTruncated && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/30">
          <MaterialIcon name="warning" className="text-sm text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Truncated — showing first {body.length.toLocaleString()} bytes of {bodySize.toLocaleString()} bytes total
          </p>
        </div>
      )}
      <pre className="bg-slate-50 dark:bg-ui-hover-dark rounded-lg p-4 text-xs font-mono text-slate-900 dark:text-white whitespace-pre-wrap wrap-break-word">
        {isPretty ? rendered : body}
      </pre>
    </div>
  );
}

function SideSection({
  title,
  icon,
  accent,
  headers,
  body,
  bodySize,
}: {
  title: string;
  icon: string;
  accent: string;
  headers: Record<string, string> | undefined;
  body: string | undefined;
  bodySize: number;
}) {
  const { copy } = useCopyToClipboard();
  const headersMap = headers ?? {};
  return (
    <section className="flex flex-col gap-4 min-w-0">
      <div className={`flex items-center gap-2 pb-2 border-b-2 ${accent}`}>
        <MaterialIcon name={icon} className="text-base" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Headers</SectionLabel>
          {Object.keys(headersMap).length > 0 && (
            <button
              onClick={() => copy(JSON.stringify(headersMap, null, 2))}
              className="flex items-center gap-1 text-xs text-slate-400 dark:text-text-dim-dark hover:text-slate-600 dark:hover:text-text-muted-dark transition-colors"
            >
              <MaterialIcon name="content_copy" className="text-xs" />
              Copy all
            </button>
          )}
        </div>
        <HeadersTable headers={headersMap} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Body</SectionLabel>
          {body && <CopyButton value={body} label="Copy body" />}
        </div>
        <BodyBlock body={body} bodySize={bodySize} />
      </div>
    </section>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function RequestDetailDrawer({ request }: RequestDetailDrawerProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-6 py-5">
        {/* Summary */}
        <div className="flex flex-col gap-3 pb-5 border-b border-slate-200 dark:border-ui-border-dark">
          {/* Method + path */}
          <div className="flex items-start gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${getMethodBadgeClass(request.method)}`}
            >
              {request.method.toUpperCase()}
            </span>
            <span className="text-sm font-mono text-slate-900 dark:text-white break-all flex-1 min-w-0">
              {request.path}
            </span>
            <CopyButton value={request.path} label="Copy path" />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetaItem
              label="Status"
              value={
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${getStatusBadgeClass(request.statusCode)}`}
                >
                  {request.statusCode}
                </span>
              }
            />
            <MetaItem label="Duration" value={formatDuration(request.durationMs)} />
            <MetaItem label="Time" value={formatTimestamp(request.createdAt)} />
            <MetaItem
              label="Request ID"
              value={
                <span className="flex items-center gap-1 font-mono">
                  <span className="truncate" title={request.requestId}>{request.requestId}</span>
                  <CopyButton value={request.requestId} label="Copy request ID" />
                </span>
              }
            />
          </div>
        </div>

        {/* Error banner */}
        {request.error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/30">
            <MaterialIcon name="error" className="text-sm text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 break-all">{request.error}</p>
          </div>
        )}

        {/* Request / Response side-by-side on lg+, stacked below */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SideSection
            title="Request"
            icon="arrow_upward"
            accent="border-sky-500/70 text-sky-600 dark:text-sky-400"
            headers={request.reqHeaders}
            body={request.reqBody}
            bodySize={request.reqBodySize}
          />
          <SideSection
            title="Response"
            icon="arrow_downward"
            accent="border-emerald-500/70 text-emerald-600 dark:text-emerald-400"
            headers={request.resHeaders}
            body={request.resBody}
            bodySize={request.resBodySize}
          />
        </div>

        {/* Raw JSON — collapsible */}
        <details className="group rounded-lg border border-slate-200 dark:border-ui-border-dark">
          <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark/50 transition-colors">
            <span className="flex items-center gap-2">
              <MaterialIcon name="data_object" className="text-sm" />
              Raw JSON
            </span>
            <MaterialIcon name="expand_more" className="text-base transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
            <div className="flex items-center justify-end">
              <CopyButton value={JSON.stringify(request, null, 2)} label="Copy raw JSON" />
            </div>
            <pre className="bg-slate-50 dark:bg-ui-hover-dark rounded-lg p-4 text-xs font-mono text-slate-900 dark:text-white whitespace-pre-wrap wrap-break-word">
              {JSON.stringify(request, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}
