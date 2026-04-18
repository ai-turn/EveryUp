import { MaterialIcon } from '../../../components/common';
import type { ApiRequest } from '../../../services/api';

interface RequestsTableProps {
  items: ApiRequest[];
  loading: boolean;
  onSelect: (req: ApiRequest) => void;
}

function getMethodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
    case 'POST':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'DELETE':
      return 'bg-red-500/10 text-red-600 dark:text-red-400';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
}

function getStatusBadgeClass(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  } else if (statusCode >= 300 && statusCode < 400) {
    return 'bg-sky-500/10 text-sky-600 dark:text-sky-400';
  } else if (statusCode >= 400 && statusCode < 500) {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  } else if (statusCode >= 500) {
    return 'bg-red-500/10 text-red-600 dark:text-red-400';
  }
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="h-3 w-16 bg-slate-200 dark:bg-ui-hover-dark rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-12 bg-slate-200 dark:bg-ui-hover-dark rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-48 bg-slate-200 dark:bg-ui-hover-dark rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-10 bg-slate-200 dark:bg-ui-hover-dark rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-12 bg-slate-200 dark:bg-ui-hover-dark rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 bg-slate-200 dark:bg-ui-hover-dark rounded animate-pulse" />
      </td>
    </tr>
  );
}

export function RequestsTable({ items, loading, onSelect }: RequestsTableProps) {
  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-ui-border-dark">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                Method
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                Request ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark/50">
            {loading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <MaterialIcon name="api" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-3" />
                    <p className="text-sm text-slate-500 dark:text-text-muted-dark">No requests captured</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              items.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => onSelect(req)}
                  className="hover:bg-slate-50 dark:hover:bg-ui-hover-dark cursor-pointer transition-colors duration-100"
                >
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-text-muted-dark whitespace-nowrap">
                    {formatTime(req.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMethodBadgeClass(req.method)}`}
                    >
                      {req.method.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span
                      className="text-sm text-slate-900 dark:text-white truncate block"
                      title={req.path !== req.pathTemplate ? req.path : undefined}
                    >
                      {req.pathTemplate}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(req.statusCode)}`}
                    >
                      {req.statusCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-text-muted-dark whitespace-nowrap">
                    {formatDuration(req.durationMs)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-text-muted-dark whitespace-nowrap">
                    {req.requestId.slice(0, 8)}&hellip;
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
