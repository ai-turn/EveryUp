import { useState, useCallback, useEffect, useMemo } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useApiRequests } from '../hooks/useApiRequests';
import { RequestFilters } from './RequestFilters';
import { api } from '../../../services/api';
import type { ApiRequest, ApiRequestListParams, ApiCaptureConfig } from '../../../services/api';

export interface RequestsTabProps {
  serviceId: string;
  onGoToSettings: () => void;
  onGoToLogs?: (requestId: string) => void;
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

function buildExampleRequests(serviceId: string): ApiRequest[] {
  const now = Date.now();
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  return [
    { id: 9101, serviceId, requestId: 'req_EXAMPLE_1001', method: 'GET',   path: '/api/v2/orders/8821',      pathTemplate: '/api/v2/orders/:id',       statusCode: 200, durationMs: 42,   clientIp: '211.234.207.18', isError: false, createdAt: ago(24) },
    { id: 9102, serviceId, requestId: 'req_EXAMPLE_1002', method: 'POST',  path: '/api/v2/orders',           pathTemplate: '/api/v2/orders',           statusCode: 500, durationMs: 1284, clientIp: '211.234.207.31', isError: true,  error: 'Cannot read properties of undefined (reading "id")', createdAt: ago(47) },
    { id: 9103, serviceId, requestId: 'req_EXAMPLE_1003', method: 'POST',  path: '/api/v2/billing/charge',   pathTemplate: '/api/v2/billing/charge',   statusCode: 504, durationMs: 5004, clientIp: '211.234.207.88', isError: true,  error: 'billing-svc timeout after 5000ms', createdAt: ago(93) },
    { id: 9104, serviceId, requestId: 'req_EXAMPLE_1004', method: 'PATCH', path: '/api/v2/users/me',         pathTemplate: '/api/v2/users/me',         statusCode: 422, durationMs: 73,   clientIp: '211.234.207.42', isError: true,  error: 'validation failed: email', createdAt: ago(130) },
    { id: 9105, serviceId, requestId: 'req_EXAMPLE_1005', method: 'GET',   path: '/api/v2/reports/safe-eye', pathTemplate: '/api/v2/reports/:type',    statusCode: 200, durationMs: 218,  clientIp: '211.234.207.15', isError: false, createdAt: ago(260) },
    { id: 9106, serviceId, requestId: 'req_EXAMPLE_1006', method: 'GET',   path: '/api/v2/orders/8821',      pathTemplate: '/api/v2/orders/:id',       statusCode: 200, durationMs: 39,   clientIp: '211.234.207.18', isError: false, createdAt: ago(390) },
  ];
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

function applyClientFilters(items: ApiRequest[], params: ApiRequestListParams): ApiRequest[] {
  const search = (params.search ?? '').trim().toLowerCase();
  return items.filter((item) => {
    if (params.method && item.method.toUpperCase() !== params.method.toUpperCase()) return false;
    if (params.minStatus !== undefined && item.statusCode < params.minStatus) return false;
    if (params.maxStatus !== undefined && item.statusCode > params.maxStatus) return false;
    if (params.errorsOnly && !item.isError) return false;
    if (params.pathPrefix && !(item.pathTemplate || item.path).startsWith(params.pathPrefix)) return false;
    if (search) {
      const haystack = [
        item.path,
        item.pathTemplate,
        item.requestId,
        item.error,
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatClock(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
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
          <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
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
}: {
  items: PathAggregateItem[];
  pickedPath: string | null;
  onPickPath: (path: string | null) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-ui-border-dark px-4 py-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">엔드포인트별 집계</h3>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark">최근 요청을 경로별로 집계합니다.</p>
        </div>
        <span className="font-mono text-xs text-slate-400 dark:text-text-dim-dark">{items.length} 엔드포인트</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-ui-border-dark bg-slate-50/70 dark:bg-ui-hover-dark/30 text-[11px] uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">
              <th className="px-4 py-2.5">메서드</th>
              <th className="px-4 py-2.5">경로</th>
              <th className="px-4 py-2.5 text-right">요청 수</th>
              <th className="px-4 py-2.5">에러율</th>
              <th className="px-4 py-2.5">응답시간</th>
              <th className="px-4 py-2.5">활동</th>
              <th className="px-4 py-2.5 text-right">마지막</th>
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
                    <span className={`rounded px-2 py-0.5 text-[11px] font-black ${methodBadge(item.method)}`}>
                      {item.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-text-base-dark">{item.pathTemplate}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-black text-slate-900 dark:text-white">{item.count}</td>
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
                  <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-text-muted-dark">{formatTimeAgo(item.lastSeen)} 전</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RequestRow({
  request,
  open,
  onToggle,
  onGoToLogs,
}: {
  request: ApiRequest;
  open: boolean;
  onToggle: () => void;
  onGoToLogs?: (requestId: string) => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-ui-hover-dark/30 ${request.isError ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
      >
        <td className="px-4 py-3 text-slate-400">
          <MaterialIcon name={open ? 'expand_more' : 'chevron_right'} className="text-lg" />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-text-muted-dark whitespace-nowrap">{formatClock(request.createdAt)}</td>
        <td className="px-4 py-3">
          <span className={`rounded px-2 py-0.5 text-[11px] font-black ${methodBadge(request.method)}`}>
            {request.method.toUpperCase()}
          </span>
        </td>
        <td className="px-4 py-3 max-w-md">
          <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">{request.path}</div>
          {request.pathTemplate && request.pathTemplate !== request.path && (
            <div className="font-mono text-[10px] text-slate-400 dark:text-text-dim-dark truncate">{request.pathTemplate}</div>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`rounded px-2 py-0.5 text-[11px] font-black ${statusBadge(request.statusCode)}`}>
            {request.statusCode}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700 dark:text-text-base-dark">{formatDuration(request.durationMs)}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-text-muted-dark">{request.clientIp ?? '-'}</td>
        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-text-muted-dark">{request.requestId}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50/80 dark:bg-ui-hover-dark/20">
          <td colSpan={8} className="px-4 pb-4 pt-1">
            <div className="ml-8 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetaCard label="요청 ID" value={request.requestId} />
                <MetaCard label="경로 템플릿" value={request.pathTemplate || '-'} />
                <MetaCard label="클라이언트 IP" value={request.clientIp ?? '-'} />
                <MetaCard label="수신 시각" value={new Date(request.createdAt).toLocaleString('ko-KR')} />
              </div>
              {request.error && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                  <div className="mb-1 text-xs font-black uppercase text-red-600 dark:text-red-400">에러</div>
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs text-red-700 dark:text-red-300">{request.error}</pre>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark/30 text-xs text-slate-500 dark:text-text-muted-dark">
                <MaterialIcon name="article" className="text-base shrink-0" />
                <span className="flex-1">요청/응답 본문은 수집하지 않습니다. 상세 내용은 서비스 로그에서 <code className="bg-slate-200 dark:bg-ui-active-dark px-1 rounded">{request.requestId}</code>로 검색하세요.</span>
                {onGoToLogs && (
                  <button
                    type="button"
                    onClick={() => onGoToLogs(request.requestId)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
                  >
                    <MaterialIcon name="open_in_new" className="text-sm" />
                    로그에서 보기
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-slate-700 dark:text-text-base-dark" title={value}>{value}</div>
    </div>
  );
}

function RequestsStreamTable({
  items,
  loading,
  openId,
  onToggle,
  onGoToLogs,
}: {
  items: ApiRequest[];
  loading: boolean;
  openId: number | null;
  onToggle: (id: number) => void;
  onGoToLogs?: (requestId: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-ui-border-dark px-4 py-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">요청 스트림</h3>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark">{items.length}건 표시</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-ui-border-dark bg-slate-50/70 dark:bg-ui-hover-dark/30 text-[11px] uppercase tracking-wide text-slate-400 dark:text-text-dim-dark">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-4 py-2.5">시각</th>
              <th className="px-4 py-2.5">메서드</th>
              <th className="px-4 py-2.5">경로</th>
              <th className="px-4 py-2.5">상태</th>
              <th className="px-4 py-2.5 text-right">응답시간</th>
              <th className="px-4 py-2.5">클라이언트 IP</th>
              <th className="px-4 py-2.5">요청 ID</th>
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
                onGoToLogs={onGoToLogs}
              />
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="py-14 text-center text-slate-500 dark:text-text-muted-dark">
                    <MaterialIcon name="api" className="text-4xl mb-2 text-slate-300 dark:text-text-dim-dark" />
                    <p>현재 필터 조건에 맞는 요청이 없습니다.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RequestsTab({ serviceId, onGoToSettings, onGoToLogs }: RequestsTabProps) {
  const [filterParams, setFilterParams] = useState<ApiRequestListParams>({
    from: new Date(Date.now() - 24 * 3600_000).toISOString(),
  });
  const [offset, setOffset] = useState(0);
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [accumulatedItems, setAccumulatedItems] = useState<ApiRequest[]>([]);

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

  const [captureConfig, setCaptureConfig] = useState<ApiCaptureConfig | null>(null);
  useEffect(() => {
    api.getApiCaptureConfig(serviceId).then(setCaptureConfig).catch(() => {});
  }, [serviceId]);

  const exampleRequests = useMemo(() => buildExampleRequests(serviceId), [serviceId]);
  const isExampleMode = !loading && !error && accumulatedItems.length === 0;
  const displayItems = useMemo(
    () => isExampleMode ? applyClientFilters(exampleRequests, filterParams) : accumulatedItems,
    [isExampleMode, exampleRequests, filterParams, accumulatedItems],
  );

  const aggregates = useMemo(() => aggregateByPath(displayItems), [displayItems]);
  const visibleItems = useMemo(
    () => displayItems.filter((item) => !pickedPath || (item.pathTemplate || item.path) === pickedPath),
    [displayItems, pickedPath],
  );

  const durations = displayItems.map((item) => item.durationMs);
  const errors = displayItems.filter((item) => item.isError).length;
  const errorRate = displayItems.length === 0 ? 0 : (errors / displayItems.length) * 100;

  const showEmpty =
    !isExampleMode && !loading && !error && accumulatedItems.length === 0 && isDefaultParams(filterParams);
  const showNoResults =
    !loading && !error && displayItems.length === 0 && !isDefaultParams(filterParams);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard label="요청 수" value={displayItems.length} icon="http" tone="primary" />
        <StatCard label="에러" value={errors} icon="error" tone={errors > 0 ? 'red' : 'slate'} suffix={`${errorRate.toFixed(1)}%`} />
        <StatCard label="P50 응답시간" value={percentile(durations, 0.5)} icon="speed" tone="sky" suffix="ms" tooltip="전체 요청 중 50%가 이 시간 이하로 응답했습니다 (중앙값)." />
        <StatCard label="P95 응답시간" value={percentile(durations, 0.95)} icon="monitoring" tone="amber" suffix="ms" tooltip="전체 요청 중 95%가 이 시간 이하로 응답했습니다. 느린 요청의 기준선입니다." />
        <StatCard label="엔드포인트" value={aggregates.length} icon="account_tree" tone="slate" />
      </div>

      {isExampleMode && displayItems.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <MaterialIcon name="science" className="text-sm" />
            실제 API 요청 캡처가 없어 예시 데이터로 화면 구성을 보여줍니다.
          </div>
          {captureConfig && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-amber-600 dark:text-amber-400 font-medium">
              <span className="flex items-center gap-1">
                <MaterialIcon name="filter_alt" className="text-xs" />
                캡처 모드:&nbsp;
                <span className="font-bold">{{
                  disabled: '캡처 안함',
                  errors_only: '에러만',
                  sampled: `샘플링 ${captureConfig.sampleRate}%`,
                  all: '모든 요청',
                }[captureConfig.mode] ?? captureConfig.mode}</span>
              </span>
            </div>
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
            아직 캡처된 요청이 없습니다
          </h3>
          <p className="text-slate-500 dark:text-text-muted-dark text-center max-w-md mb-6">
            API 캡처를 설정하면 이 서비스의 HTTP 요청이 기록됩니다.
          </p>
          <button
            onClick={onGoToSettings}
            className="px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg text-white font-bold transition-colors"
          >
            캡처 설정하기
          </button>
        </div>
      )}

      {showNoResults && (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark">
          <MaterialIcon name="search_off" className="text-4xl text-slate-300 dark:text-text-dim-dark mb-3" />
          <p className="text-slate-500 dark:text-text-muted-dark text-sm">
            현재 필터 조건에 맞는 요청이 없습니다.
          </p>
        </div>
      )}

      {!showEmpty && !showNoResults && (
        <>
          <PathAggregateTable
            items={aggregates}
            pickedPath={pickedPath}
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
                초기화
              </button>
            </div>
          )}

          <RequestsStreamTable
            items={visibleItems}
            loading={loading}
            openId={openId}
            onToggle={(id) => setOpenId(openId === id ? null : id)}
            onGoToLogs={onGoToLogs}
          />

          {!isExampleMode && accumulatedItems.length > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-text-muted-dark px-1">
              <span>{total}건 중 {accumulatedItems.length}건 표시</span>
              {accumulatedItems.length < total && (
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-ui-hover-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark font-bold text-slate-700 dark:text-text-secondary-dark transition-colors disabled:opacity-50"
                >
                  더 보기
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
