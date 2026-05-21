import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { useApiRequests } from '../hooks/useApiRequests';
import { RequestFilters } from './RequestFilters';
import { TracePanel } from '../../traces/components/TracePanel';
import type { ApiRequest, ApiRequestListParams } from '../../../services/api';

export interface RequestsTabProps {
  serviceId: string;
  initialTraceId?: string | null;
  onClearTraceFilter?: () => void;
}

function shortTraceId(traceId: string): string {
  return traceId.length <= 16 ? traceId : `${traceId.slice(0, 16)}...`;
}

const DEFAULT_LIMIT = 50;

interface PathAggregateItem {
  key: string;
  method: string;
  pathTemplate: string;
  count: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  lastSeen: string;
  buckets: number[];
  errorBuckets: number[];
}

function isDefaultParams(params: ApiRequestListParams): boolean {
  return (
    !params.search &&
    !params.method &&
    !params.minStatus &&
    !params.maxStatus &&
    !params.pathPrefix &&
    !params.errorsOnly
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatClock(isoString: string): string {
  return new Date(isoString).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '-';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function methodBadge(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400';
    case 'POST':
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    case 'DELETE':
      return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    default:
      return 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark';
  }
}

function statusBadge(status: number): string {
  if (status >= 500) return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  if (status >= 400) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  if (status >= 300) return 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400';
  if (status >= 200) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
  return 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark';
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function bucketIndex(dateStr: string): number {
  const ageMinutes = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
  return 11 - Math.min(11, Math.max(0, Math.floor(ageMinutes / 5)));
}

function aggregateByPath(items: ApiRequest[]): PathAggregateItem[] {
  const map = new Map<string, ApiRequest[]>();
  items.forEach((item) => {
    const key = `${item.method.toUpperCase()} ${item.pathTemplate || item.path}`;
    map.set(key, [...(map.get(key) ?? []), item]);
  });

  return Array.from(map.entries())
    .map(([key, requests]) => {
      const first = requests[0];
      const durations = requests.map((r) => r.durationMs);
      const buckets = Array.from({ length: 12 }, () => 0);
      const errorBuckets = Array.from({ length: 12 }, () => 0);
      requests.forEach((request) => {
        const index = bucketIndex(request.createdAt);
        buckets[index] += 1;
        if (request.isError) errorBuckets[index] += 1;
      });
      const errors = requests.filter((r) => r.isError).length;
      const lastSeen = requests.reduce((latest, request) =>
        new Date(request.createdAt).getTime() > new Date(latest).getTime() ? request.createdAt : latest,
      requests[0].createdAt);

      return {
        key,
        method: first.method.toUpperCase(),
        pathTemplate: first.pathTemplate || first.path,
        count: requests.length,
        errors,
        errorRate: requests.length === 0 ? 0 : errors / requests.length,
        p50: percentile(durations, 0.5),
        p95: percentile(durations, 0.95),
        p99: percentile(durations, 0.99),
        lastSeen,
        buckets,
        errorBuckets,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function MiniBars({ buckets, errorBuckets }: { buckets: number[]; errorBuckets?: number[] }) {
  const max = Math.max(...buckets, 1);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {buckets.map((value, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-t ${value === 0 ? 'bg-slate-200 dark:bg-ui-hover-dark' : errorBuckets?.[index] ? 'bg-red-500' : 'bg-primary/60'}`}
          style={{ height: `${Math.max(3, (value / max) * 32)}px` }}
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
  suffix,
  tooltip,
}: {
  label: string;
  value: string | number;
  icon: string;
  tone: 'primary' | 'red' | 'amber' | 'sky' | 'slate';
  suffix?: string;
  tooltip?: string;
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    sky: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    slate: 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
          <MaterialIcon name={icon} className="text-lg" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-text-muted-dark">
            {label}
            {tooltip && (
              <span className="relative group/tip cursor-default">
                <MaterialIcon name="info" className="text-xs text-slate-400 hover:text-slate-500 dark:text-text-dim-dark" />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg bg-slate-800 dark:bg-slate-700 px-2.5 py-1.5 text-[11px] font-normal text-white shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-10 whitespace-normal text-center leading-snug">
                  {tooltip}
                </span>
              </span>
            )}
          </p>
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">
            {value}
            {suffix && <span className="ml-1 text-xs font-bold text-slate-400 dark:text-text-dim-dark">{suffix}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function PathAggregateTable({
  items,
  pickedPath,
  onPickPath,
  t,
}: {
  items: PathAggregateItem[];
  pickedPath: string | null;
  onPickPath: (path: string | null) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-ui-border-dark px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('apiRequests.summary.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark">{t('apiRequests.summary.description')}</p>
        </div>
        <span className="font-mono text-xs text-slate-400 dark:text-text-dim-dark">
          {t('apiRequests.summary.endpointCount', { count: items.length })}
        </span>
      </div>
      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-ui-border-dark bg-slate-50/70 dark:bg-ui-hover-dark/30 text-[11px] uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">
              <th className="px-4 py-2.5">{t('apiRequests.table.method')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.path')}</th>
              <th className="px-4 py-2.5 text-right">{t('apiRequests.table.requests')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.errors')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.latency')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.trend')}</th>
              <th className="px-4 py-2.5 text-right">{t('apiRequests.table.lastSeen')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
            {items.map((item) => {
              const active = pickedPath === item.pathTemplate;
              return (
                <tr
                  key={item.key}
                  onClick={() => onPickPath(active ? null : item.pathTemplate)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30 ${active ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${methodBadge(item.method)}`}>
                      {item.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-text-base-dark">{item.pathTemplate}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900 dark:text-white">{item.count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-ui-hover-dark">
                        <div
                          className={item.errorRate >= 0.05 ? 'h-full bg-red-500' : item.errorRate > 0 ? 'h-full bg-amber-400' : 'h-full bg-slate-300 dark:bg-ui-active-dark'}
                          style={{ width: `${Math.min(100, item.errorRate * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-slate-500 dark:text-text-muted-dark">{(item.errorRate * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-text-muted-dark">
                    <span className="font-bold text-slate-900 dark:text-white">{item.p50}</span>
                    <span className="text-slate-400"> / {item.p95} / {item.p99}ms</span>
                  </td>
                  <td className="px-4 py-3">
                    <MiniBars buckets={item.buckets} errorBuckets={item.errorBuckets} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-text-muted-dark">
                    {t('apiRequests.timeAgo', { value: formatTimeAgo(item.lastSeen) })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="sm:hidden divide-y divide-slate-100 dark:divide-ui-border-dark/60">
        {items.map((item) => {
          const active = pickedPath === item.pathTemplate;
          return (
            <li
              key={item.key}
              onClick={() => onPickPath(active ? null : item.pathTemplate)}
              className={`cursor-pointer px-4 py-3 transition-colors ${active ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${methodBadge(item.method)}`}>
                  {item.method}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800 dark:text-text-base-dark">
                  {item.pathTemplate}
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{item.count}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-text-muted-dark">
                <span className={item.errorRate >= 0.05 ? 'text-red-600 dark:text-red-400' : item.errorRate > 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                  {t('apiRequests.table.errors')} {(item.errorRate * 100).toFixed(1)}%
                </span>
                <span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.p50}</span>
                  <span className="text-slate-400"> / {item.p95} / {item.p99}ms</span>
                </span>
                <span className="ml-auto whitespace-nowrap">
                  {t('apiRequests.timeAgo', { value: formatTimeAgo(item.lastSeen) })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RequestRow({
  request,
  open,
  onToggle,
  onOpenTrace,
  t,
}: {
  request: ApiRequest;
  open: boolean;
  onToggle: () => void;
  onOpenTrace: (traceId: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  // Only error requests have anything worth expanding (the full error text).
  // Non-error rows are not clickable — every other field is already a column.
  const expandable = !!request.error;
  return (
    <>
      <tr
        onClick={expandable ? onToggle : undefined}
        className={`transition-colors hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30 ${expandable ? 'cursor-pointer' : ''} ${request.isError ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
      >
        <td className="px-4 py-3 text-slate-400">
          {expandable && (
            <MaterialIcon name={open ? 'expand_more' : 'chevron_right'} className="text-lg" />
          )}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-text-muted-dark whitespace-nowrap">{formatClock(request.createdAt)}</td>
        <td className="px-4 py-3">
          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${methodBadge(request.method)}`}>
            {request.method.toUpperCase()}
          </span>
        </td>
        <td className="px-4 py-3 max-w-md">
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate" title={request.path}>{request.path}</div>
            {request.pathTemplate && request.pathTemplate !== request.path && (
              <div className="font-mono text-[10px] text-slate-400 dark:text-text-dim-dark truncate">{request.pathTemplate}</div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${statusBadge(request.statusCode)}`}>
            {request.statusCode}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700 dark:text-text-base-dark">{formatDuration(request.durationMs)}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-text-muted-dark">{request.clientIp ?? '-'}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {request.traceId && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTrace(request.traceId!);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                title={request.traceId}
              >
                <MaterialIcon name="timeline" className="text-sm" />
                <span>{t('apiRequests.actions.viewTrace')}</span>
              </button>
            </div>
          )}
        </td>
      </tr>
      {open && expandable && (
        <tr className="bg-slate-50/80 dark:bg-ui-hover-dark/20">
          <td colSpan={8} className="px-4 pb-4 pt-1">
            <div className="ml-8 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="mb-1 text-xs font-bold uppercase text-red-600 dark:text-red-400">{t('apiRequests.detail.error')}</div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-red-700 dark:text-red-300">{request.error}</pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Mobile request entry — stacked card replacing the table row on narrow screens.
function RequestCard({
  request,
  open,
  onToggle,
  onOpenTrace,
  t,
}: {
  request: ApiRequest;
  open: boolean;
  onToggle: () => void;
  onOpenTrace: (traceId: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const expandable = !!request.error;
  return (
    <li
      onClick={expandable ? onToggle : undefined}
      className={`px-4 py-3 transition-colors ${expandable ? 'cursor-pointer' : ''} ${request.isError ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${methodBadge(request.method)}`}>
          {request.method.toUpperCase()}
        </span>
        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${statusBadge(request.statusCode)}`}>
          {request.statusCode}
        </span>
        <span className="ml-auto font-mono text-xs font-bold text-slate-700 dark:text-text-base-dark">
          {formatDuration(request.durationMs)}
        </span>
        {expandable && (
          <MaterialIcon name={open ? 'expand_more' : 'chevron_right'} className="text-lg text-slate-400" />
        )}
      </div>
      <div className="mt-1.5 font-mono text-xs font-semibold text-slate-900 dark:text-white truncate" title={request.path}>
        {request.path}
      </div>
      {request.pathTemplate && request.pathTemplate !== request.path && (
        <div className="font-mono text-[10px] text-slate-400 dark:text-text-dim-dark truncate">{request.pathTemplate}</div>
      )}
      <div className="mt-1.5 flex items-center gap-3 font-mono text-[11px] text-slate-500 dark:text-text-muted-dark">
        <span className="whitespace-nowrap">{formatClock(request.createdAt)}</span>
        <span className="truncate">{request.clientIp ?? '-'}</span>
        {request.traceId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTrace(request.traceId!);
            }}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
            title={request.traceId}
          >
            <MaterialIcon name="timeline" className="text-sm" />
            <span>{t('apiRequests.actions.viewTrace')}</span>
          </button>
        )}
      </div>
      {open && expandable && (
        <div className="mt-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <div className="mb-1 text-xs font-bold uppercase text-red-600 dark:text-red-400">{t('apiRequests.detail.error')}</div>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-red-700 dark:text-red-300">{request.error}</pre>
        </div>
      )}
    </li>
  );
}

function RequestsStreamTable({
  items,
  loading,
  openId,
  onToggle,
  onOpenTrace,
  t,
}: {
  items: ApiRequest[];
  loading: boolean;
  openId: number | null;
  onToggle: (id: number) => void;
  onOpenTrace: (traceId: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-ui-border-dark px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('apiRequests.stream.title')}</h3>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark">{t('apiRequests.stream.rows', { count: items.length })}</p>
        </div>
      </div>
      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-ui-border-dark bg-slate-50/70 dark:bg-ui-hover-dark/30 text-[11px] uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-4 py-2.5">{t('apiRequests.table.time')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.method')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.path')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.status')}</th>
              <th className="px-4 py-2.5 text-right">{t('apiRequests.table.latency')}</th>
              <th className="px-4 py-2.5">{t('apiRequests.table.clientIp')}</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
            {loading && items.length === 0 && [1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td colSpan={8} className="px-4 py-3">
                  <div className="h-8 rounded bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
                </td>
              </tr>
            ))}
            {items.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                open={openId === request.id}
                onToggle={() => onToggle(request.id)}
                onOpenTrace={onOpenTrace}
                t={t}
              />
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="py-14 text-center text-slate-500 dark:text-text-muted-dark">
                    <MaterialIcon name="api" className="text-4xl mb-2 text-slate-300 dark:text-text-dim-dark" />
                    <p>{t('apiRequests.empty.noResults')}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="sm:hidden">
        {loading && items.length === 0 && (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 rounded bg-slate-100 dark:bg-ui-hover-dark animate-pulse" />
            ))}
          </div>
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-ui-border-dark/60">
            {items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                open={openId === request.id}
                onToggle={() => onToggle(request.id)}
                onOpenTrace={onOpenTrace}
                t={t}
              />
            ))}
          </ul>
        )}
        {!loading && items.length === 0 && (
          <div className="py-14 text-center text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="api" className="text-4xl mb-2 text-slate-300 dark:text-text-dim-dark" />
            <p>{t('apiRequests.empty.noResults')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function RequestsTab({ serviceId, initialTraceId, onClearTraceFilter }: RequestsTabProps) {
  const { t } = useTranslation('logs');
  const [filterParams, setFilterParams] = useState<ApiRequestListParams>({
    from: new Date(Date.now() - 24 * 3600_000).toISOString(),
    ...(initialTraceId ? { traceId: initialTraceId } : {}),
  });
  const [offset, setOffset] = useState(0);
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [accumulatedItems, setAccumulatedItems] = useState<ApiRequest[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  // Sync external traceId filter into local params when it changes.
  useEffect(() => {
    setFilterParams((prev) => {
      const next = { ...prev };
      if (initialTraceId) next.traceId = initialTraceId;
      else delete next.traceId;
      return next;
    });
    setOffset(0);
  }, [initialTraceId]);

  const fetchParams: ApiRequestListParams = { ...filterParams, limit: DEFAULT_LIMIT, offset };
  const { items, total, loading, error } = useApiRequests(serviceId, fetchParams);

  useEffect(() => {
    if (loading) return;
    if (offset === 0) {
      setAccumulatedItems(items);
    } else {
      setAccumulatedItems((prev) => [...prev, ...items]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading]);

  const handleParamsChange = useCallback((next: ApiRequestListParams) => {
    setFilterParams(next);
    setOffset(0);
    setPickedPath(null);
    setOpenId(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    setOffset((prev) => prev + DEFAULT_LIMIT);
  }, []);

  const displayItems = accumulatedItems;

  const aggregates = useMemo(() => aggregateByPath(displayItems), [displayItems]);
  const visibleItems = useMemo(
    () => displayItems.filter((item) => !pickedPath || (item.pathTemplate || item.path) === pickedPath),
    [displayItems, pickedPath],
  );

  const durations = displayItems.map((item) => item.durationMs);
  const errors = displayItems.filter((item) => item.isError).length;
  const errorRate = displayItems.length === 0 ? 0 : (errors / displayItems.length) * 100;

  const showEmpty =
    !loading && !error && accumulatedItems.length === 0 && isDefaultParams(filterParams);
  const showNoResults =
    !loading && !error && displayItems.length === 0 && !isDefaultParams(filterParams);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label={t('apiRequests.stats.requests')} value={displayItems.length} icon="http" tone="primary" />
        <StatCard label={t('apiRequests.stats.errors')} value={errors} icon="error" tone={errors > 0 ? 'red' : 'slate'} suffix={`${errorRate.toFixed(1)}%`} />
        <StatCard label={t('apiRequests.stats.p50')} value={percentile(durations, 0.5)} icon="speed" tone="sky" suffix="ms" tooltip={t('apiRequests.stats.p50Tooltip')} />
        <StatCard label={t('apiRequests.stats.p95')} value={percentile(durations, 0.95)} icon="monitoring" tone="amber" suffix="ms" tooltip={t('apiRequests.stats.p95Tooltip')} />
        <StatCard label={t('apiRequests.stats.endpoints')} value={aggregates.length} icon="account_tree" tone="slate" />
      </div>

      {initialTraceId && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          <MaterialIcon name="timeline" className="text-sm" />
          <span>{t('apiRequests.traceFilter.label')}</span>
          <code className="font-mono truncate" title={initialTraceId}>{shortTraceId(initialTraceId)}</code>
          {onClearTraceFilter && (
            <button onClick={onClearTraceFilter} className="ml-auto rounded px-2 py-1 font-bold hover:bg-primary/20">
              {t('apiRequests.actions.clear')}
            </button>
          )}
        </div>
      )}

      <RequestFilters
        params={filterParams}
        onChange={handleParamsChange}
        pathSuggestions={Array.from(new Set(displayItems.map((r) => r.path))).slice(0, 20)}
      />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <MaterialIcon name="error_outline" className="text-base shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl border border-dashed border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center mb-6">
            <MaterialIcon name="http" className="text-4xl text-slate-400 dark:text-text-dim-dark" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {t('apiRequests.empty.title')}
          </h3>
          <p className="text-slate-500 dark:text-text-muted-dark text-center max-w-md mb-6">
            {t('apiRequests.empty.description')}
          </p>
        </div>
      )}

      {showNoResults && (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
          <MaterialIcon name="search_off" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-3" />
          <p className="text-slate-500 dark:text-text-muted-dark text-sm">
            {t('apiRequests.empty.noResults')}
          </p>
        </div>
      )}

      {!showEmpty && !showNoResults && (
        <>
          <PathAggregateTable
            items={aggregates}
            pickedPath={pickedPath}
            t={t}
            onPickPath={(path) => {
              setPickedPath(path);
              setOpenId(null);
            }}
          />

          {pickedPath && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <MaterialIcon name="filter_alt" className="text-sm" />
              <span className="font-mono">{pickedPath}</span>
              <button onClick={() => setPickedPath(null)} className="ml-auto rounded px-2 py-1 font-bold hover:bg-primary/10">
                {t('apiRequests.actions.clear')}
              </button>
            </div>
          )}

          <RequestsStreamTable
            items={visibleItems}
            loading={loading}
            openId={openId}
            onToggle={(id) => setOpenId(openId === id ? null : id)}
            onOpenTrace={setActiveTraceId}
            t={t}
          />

          {accumulatedItems.length > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-text-muted-dark px-1">
              <span>{t('apiRequests.pagination.showing', { shown: accumulatedItems.length, total })}</span>
              {accumulatedItems.length < total && (
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-ui-hover-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark font-bold text-slate-700 dark:text-text-secondary-dark transition-colors disabled:opacity-50"
                >
                  {t('apiRequests.actions.loadMore')}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {activeTraceId && (
        <TracePanel traceId={activeTraceId} onClose={() => setActiveTraceId(null)} />
      )}
    </div>
  );
}
