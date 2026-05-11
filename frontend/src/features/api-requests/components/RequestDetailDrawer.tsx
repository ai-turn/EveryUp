import { useState } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import type { ApiRequest } from '../../../services/api';
import { TracePanel } from '../../traces/components/TracePanel';

export interface RequestDetailDrawerProps {
  request: ApiRequest;
  onClose?: () => void;
}

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
  return new Date(isoString).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
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

export function RequestDetailDrawer({ request }: RequestDetailDrawerProps) {
  const [traceOpen, setTraceOpen] = useState(false);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-6 py-5">
        {/* Summary */}
        <div className="flex flex-col gap-3 pb-5 border-b border-slate-200 dark:border-ui-border-dark">
          <div className="flex items-start gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${getMethodBadgeClass(request.method)}`}>
              {request.method.toUpperCase()}
            </span>
            <span className="text-sm font-mono text-slate-900 dark:text-white break-all flex-1 min-w-0">
              {request.path}
            </span>
            <CopyButton value={request.path} label="Copy path" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetaItem
              label="Status"
              value={
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${getStatusBadgeClass(request.statusCode)}`}>
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

        {/* Trace correlation */}
        {request.traceId && (
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-slate-50/60 dark:bg-ui-hover-dark/30">
            <div className="flex items-center gap-2">
              <MaterialIcon name="timeline" className="text-slate-400 text-base" />
              <span className="text-sm font-semibold text-slate-700 dark:text-text-secondary-dark">
                Trace
              </span>
              <code className="ml-auto text-[11px] font-mono text-slate-500 dark:text-text-muted-dark truncate" title={request.traceId}>
                {request.traceId.slice(0, 16)}…
              </code>
            </div>
            <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
              Open the full trace to see all spans and correlated logs that share this trace ID.
            </p>
            <button
              type="button"
              onClick={() => setTraceOpen(true)}
              className="mt-1 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer"
            >
              <MaterialIcon name="open_in_full" className="text-sm" />
              View trace
            </button>
          </div>
        )}

        {/* Client IP */}
        {request.clientIp && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="location_on" className="text-sm" />
            <span>Client IP: <span className="font-mono text-slate-700 dark:text-text-secondary-dark">{request.clientIp}</span></span>
          </div>
        )}
      </div>

      {traceOpen && request.traceId && (
        <TracePanel traceId={request.traceId} onClose={() => setTraceOpen(false)} />
      )}
    </div>
  );
}
