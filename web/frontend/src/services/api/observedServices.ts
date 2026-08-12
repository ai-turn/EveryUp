import { request } from './base';
import type { ApiRequest, LogEntry, LogHistogramBucket, LogLevel } from './services';
import type {
  ApiRequestStatBucket,
  ApiRequestStatusSummary,
  OtelMetricName,
  OtelMetricPoint,
  OtelServiceMetric,
} from './telemetry';

export type TelemetrySignal = 'logs' | 'metrics' | 'traces';

export interface ObservedService {
  id: string;
  name: string;
  projectId?: string;
  signals: TelemetrySignal[];
  logLevelFilter?: LogLevel[];
  apiExcludePaths?: string[];
  isActive: boolean;
  apiKeyMasked?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ObservedServiceInput {
  name: string;
  projectId?: string;
  signals: TelemetrySignal[];
}

export interface ObservedServiceSetup extends ObservedService {
  apiKey: string;
}

export interface DirectLogQuery {
  level?: LogLevel;
  search?: string;
  traceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface DirectMetricPointQuery {
  name: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface DirectApiRequestQuery {
  search?: string;
  errorsOnly?: boolean;
  from?: string;
  to?: string;
  minStatus?: number;
  maxStatus?: number;
  limit?: number;
  offset?: number;
}

function logQuery(params?: DirectLogQuery): URLSearchParams {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 100));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.level) query.set('level', params.level);
  if (params?.search) query.set('search', params.search);
  if (params?.traceId) query.set('traceId', params.traceId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  return query;
}

function apiRequestQuery(params?: DirectApiRequestQuery): URLSearchParams {
  const query = new URLSearchParams();
  query.set('limit', String(params?.limit ?? 100));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.search) query.set('search', params.search);
  if (params?.errorsOnly) query.set('errorsOnly', 'true');
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.minStatus) query.set('minStatus', String(params.minStatus));
  if (params?.maxStatus) query.set('maxStatus', String(params.maxStatus));
  return query;
}

export const observedServicesApi = {
  getObservedServices: (signal?: TelemetrySignal) =>
    request<ObservedService[]>(`/observed-services${signal ? `?signal=${signal}` : ''}`),

  getObservedService: (id: string) =>
    request<ObservedService>(`/observed-services/${id}`),

  createObservedService: (data: ObservedServiceInput) =>
    request<ObservedServiceSetup>('/observed-services', { method: 'POST', body: JSON.stringify(data) }),

  updateObservedService: (id: string, data: ObservedServiceInput) =>
    request<ObservedService>(`/observed-services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteObservedService: (id: string) =>
    request<void>(`/observed-services/${id}`, { method: 'DELETE' }),

  rotateObservedServiceKey: (id: string) =>
    request<ObservedServiceSetup>(`/observed-services/${id}/rotate-key`, { method: 'POST' }),

  revokeObservedServiceKey: (id: string) =>
    request<ObservedService>(`/observed-services/${id}/revoke-key`, { method: 'POST' }),

  getObservedServiceLogs: (id: string, params?: DirectLogQuery) =>
    request<{ data: LogEntry[]; total: number }>(`/observed-services/${id}/logs?${logQuery(params)}`),

  getObservedServiceLogHistogram: (
    id: string,
    params?: Omit<DirectLogQuery, 'traceId' | 'limit' | 'offset'> & { bucketMins?: number },
  ) => {
    const query = logQuery(params);
    query.delete('limit');
    if (params?.bucketMins) query.set('bucketMins', String(params.bucketMins));
    return request<LogHistogramBucket[]>(`/observed-services/${id}/log-histogram?${query}`);
  },

  getObservedServiceLogFilter: (id: string) =>
    request<{ levels: LogLevel[] }>(`/observed-services/${id}/log-filter`),

  setObservedServiceLogFilter: (id: string, levels: LogLevel[]) =>
    request<{ levels: LogLevel[] }>(`/observed-services/${id}/log-filter`, {
      method: 'PUT',
      body: JSON.stringify({ levels }),
    }),

  getObservedServiceMetrics: () =>
    request<OtelServiceMetric[]>('/observed-services/service-metrics'),

  getObservedServiceOtelMetricNames: (id: string) =>
    request<OtelMetricName[]>(`/observed-services/${id}/otel-metrics`),

  getObservedServiceOtelMetricPoints: (id: string, params: DirectMetricPointQuery) => {
    const query = new URLSearchParams({ name: params.name });
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.limit) query.set('limit', String(params.limit));
    return request<OtelMetricPoint[]>(`/observed-services/${id}/otel-metrics/points?${query}`);
  },

  getObservedServiceRequests: (id: string, params?: DirectApiRequestQuery) =>
    request<{ data: ApiRequest[]; total: number }>(`/observed-services/${id}/requests?${apiRequestQuery(params)}`),

  getObservedServiceRequestStats: (
    id: string,
    params?: { from?: string; to?: string; bucketMins?: number },
  ) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.bucketMins) query.set('bucketMins', String(params.bucketMins));
    return request<ApiRequestStatBucket[]>(`/observed-services/${id}/request-stats?${query}`);
  },

  getObservedServiceRequestStatusSummary: (
    id: string,
    params?: { from?: string; to?: string },
  ) => {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    return request<ApiRequestStatusSummary>(`/observed-services/${id}/request-status-summary?${query}`);
  },

  getObservedServiceApiExclusions: (id: string) =>
    request<{ paths: string[] }>(`/observed-services/${id}/api-exclusions`),

  setObservedServiceApiExclusions: (id: string, paths: string[]) =>
    request<{ paths: string[] }>(`/observed-services/${id}/api-exclusions`, {
      method: 'PUT',
      body: JSON.stringify({ paths }),
    }),
};
