import { useState } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import type { ApiRequest } from '../../../services/api';

export interface RequestDetailDrawerProps {
  request: ApiRequest;
  onClose?: () => void;
}

type TabKey = 'request' | 'response' | 'raw';

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
    <p className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider mb-2">
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

function HeadersSection({
  headers,
  onCopyAll,
}: {
  headers: Record<string, string>;
  onCopyAll: () => void;
}) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-text-dim-dark italic">No headers</p>;
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Headers</SectionLabel>
        <button
          onClick={onCopyAll}
          className="flex items-center gap-1 text-xs text-slate-400 dark:text-text-dim-dark hover:text-slate-600 dark:hover:text-text-muted-dark transition-colors"
        >
          <MaterialIcon name="content_copy" className="text-xs" />
          Copy all
        </button>
      </div>
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-xs font-mono">
            <span className="text-slate-500 dark:text-text-muted-dark shrink-0 min-w-0 break-all">{key}:</span>
            <span
              className={`min-w-0 break-all ${
                isMasked(value)
                  ? 'text-amber-500'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BodySection({
  label,
  body,
  bodySize,
}: {
  label: string;
  body: string | undefined;
  bodySize: number;
}) {
  if (!body) {
    return (
      <div>
        <SectionLabel>{label}</SectionLabel>
        <p className="text-xs text-slate-400 dark:text-text-dim-dark italic">No body</p>
      </div>
    );
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>{label}</SectionLabel>
        <CopyButton value={body} label="Copy body" />
      </div>
      {isTruncated && (
        <div className="flex items-center gap-1.5 px-3 py-2 mb-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/30">
          <MaterialIcon name="warning" className="text-sm text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Truncated — showing first {body.length.toLocaleString()} bytes of {bodySize.toLocaleString()} bytes total
          </p>
        </div>
      )}
      <pre className="bg-slate-50 dark:bg-ui-hover-dark rounded-lg p-4 text-xs font-mono overflow-auto max-h-96 text-slate-900 dark:text-white">
        {isPretty ? rendered : body}
      </pre>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function RequestDetailDrawer({ request }: RequestDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('request');
  const { copy } = useCopyToClipboard();

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'request',  label: 'Request'  },
    { key: 'response', label: 'Response' },
    { key: 'raw',      label: 'Raw JSON' },
  ];

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Header section */}
      <div className="flex flex-col gap-2">
        {/* Row 1: method + path + copy */}
        <div className="flex items-start gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${getMethodBadgeClass(request.method)}`}
          >
            {request.method.toUpperCase()}
          </span>
          <span className="text-sm font-mono text-slate-900 dark:text-white break-all flex-1 min-w-0">
            {request.path}
          </span>
          <CopyButton value={request.path} label="Copy path" />
        </div>

        {/* Row 2: status + duration */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(request.statusCode)}`}
          >
            {request.statusCode}
          </span>
          <span className="text-xs text-slate-500 dark:text-text-muted-dark">
            {formatDuration(request.durationMs)}
          </span>
          <span className="text-xs text-slate-500 dark:text-text-muted-dark">
            {formatTimestamp(request.createdAt)}
          </span>
        </div>

        {/* Row 3: request ID */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 dark:text-text-dim-dark">ID:</span>
          <span className="text-xs font-mono text-slate-600 dark:text-text-muted-dark truncate flex-1 min-w-0">
            {request.requestId}
          </span>
          <CopyButton value={request.requestId} label="Copy request ID" />
        </div>

        {/* Error banner */}
        {request.error && (
          <div className="flex items-start gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700/30">
            <MaterialIcon name="error" className="text-sm text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 break-all">{request.error}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-ui-border-dark">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex flex-col gap-6">
        {/* Request Tab */}
        {activeTab === 'request' && (
          <>
            <HeadersSection
              headers={request.reqHeaders ?? {}}
              onCopyAll={() => copy(JSON.stringify(request.reqHeaders ?? {}, null, 2))}
            />
            <BodySection
              label="Body"
              body={request.reqBody}
              bodySize={request.reqBodySize}
            />
          </>
        )}

        {/* Response Tab */}
        {activeTab === 'response' && (
          <>
            <HeadersSection
              headers={request.resHeaders ?? {}}
              onCopyAll={() => copy(JSON.stringify(request.resHeaders ?? {}, null, 2))}
            />
            <BodySection
              label="Body"
              body={request.resBody}
              bodySize={request.resBodySize}
            />
          </>
        )}

        {/* Raw JSON Tab */}
        {activeTab === 'raw' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Full Request Object</SectionLabel>
              <CopyButton value={JSON.stringify(request, null, 2)} label="Copy raw JSON" />
            </div>
            <pre className="bg-slate-50 dark:bg-ui-hover-dark rounded-lg p-4 text-xs font-mono overflow-auto max-h-96 text-slate-900 dark:text-white">
              {JSON.stringify(request, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
