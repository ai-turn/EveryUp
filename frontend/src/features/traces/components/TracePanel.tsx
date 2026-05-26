import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
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

function copyButton(onClick: () => void, label: string) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-ui-active-dark dark:hover:text-slate-200"
      title={label}
      aria-label={label}
    >
      <MaterialIcon name="content_copy" className="text-sm" />
    </button>
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
              <button
                onClick={() => copy(traceId)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                title="Copy trace ID"
                aria-label="Copy trace ID"
              >
                <MaterialIcon name="content_copy" className="text-sm" />
              </button>
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
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {isEmpty && (
            <div className="text-center py-10 text-sm text-slate-500 dark:text-text-muted-dark">
              No spans, logs, or API requests for this trace.
            </div>
          )}

          {!loading && !error && serviceId && (logs.length > 0 || apiRequests.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-text-muted-dark mr-1">
                {t('apiRequests.tracePanel.jumpTo')}
              </span>
              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpTo('logs')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <MaterialIcon name="article" className="text-sm" />
                  {t('apiRequests.tracePanel.openInLogs', { count: logs.length })}
                </button>
              )}
              {apiRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpTo('requests')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer"
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
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark border border-slate-100 dark:border-ui-border-dark text-xs sm:flex-nowrap"
          >
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${spanKindBadge(span.kind)}`}>
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
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${statusBadge(span.statusCode)}`}>
                {span.statusCode}
              </span>
            )}
            <span className="text-slate-500 dark:text-text-muted-dark font-mono shrink-0">
              {formatDuration(span.durationMs)}
            </span>
            {copyButton(() => { void onCopy(formatSpanCopy(span)); }, 'Copy span row')}
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
            className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark border border-slate-100 dark:border-ui-border-dark text-xs sm:flex-nowrap"
          >
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-ui-active-dark text-slate-700 dark:text-text-base-dark shrink-0">
              {req.method}
            </span>
            <span className="font-mono text-slate-700 dark:text-text-base-dark truncate flex-1 min-w-0" title={req.path}>
              {req.path}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
              req.isError
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {req.statusCode}
            </span>
            <span className="text-slate-500 dark:text-text-muted-dark font-mono shrink-0">
              {formatDuration(req.durationMs)}
            </span>
            {copyButton(() => { void onCopy(formatApiRequestCopy(req)); }, 'Copy API request row')}
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
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark border border-slate-100 dark:border-ui-border-dark text-xs"
          >
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${logLevelBadge(log.level)}`}>
              {log.level.toUpperCase()}
            </span>
            <span className="text-slate-500 dark:text-text-muted-dark font-mono shrink-0 mt-0.5">
              {formatTime(log.createdAt)}
            </span>
            <span className="text-slate-700 dark:text-text-base-dark break-all flex-1 min-w-0">
              {log.message}
            </span>
            {copyButton(() => { void onCopy(formatLogCopy(log)); }, 'Copy log row')}
          </li>
        ))}
      </ul>
    </section>
  );
}
