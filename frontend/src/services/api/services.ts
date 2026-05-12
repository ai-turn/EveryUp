import type { RequestFn } from './base';

// --- Types ---

export interface Service {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'icmp' | 'log';
  url?: string;
  host?: string;
  port?: number;
  method?: string;
  interval: number;
  timeout: number;
  expectedStatus?: number;
  isActive: boolean;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastCheckedAt?: string;
  tags?: string[];
  apiKey?: string;
  apiKeyMasked?: string;
  uptime?: number;
  responseTime?: number;
  scheduleType: 'interval' | 'cron';
  cronExpression?: string;
  createdAt?: string;
  // log-type services only. undefined/[] = accept all levels.
  logLevelFilter?: LogLevel[];
  // computed from recent metrics — oldest→newest
  latencyHistory?: number[];
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'] as const;

export interface CreateServiceData {
  name: string;
  id: string;
  type: 'http' | 'tcp' | 'icmp' | 'log';
  url?: string;
  host?: string;
  port?: number;
  method?: string;
  interval?: number;
  timeout?: number;
  expectedStatus?: number;
  tags?: string[];
  scheduleType?: 'interval' | 'cron';
  cronExpression?: string;
  logLevelFilter?: LogLevel[];
}

export interface CheckEntry {
  id: number;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  status: 'success' | 'failure';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface HealthCheckKpiSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  unknown: number;
  avgUptime: number;
  avgLatency: number;
  activeIncidents: number;
  latencyHistory: number[]; // 24 hourly avg ms, oldest→newest
}

export interface Metric {
  id: string;
  serviceId: string;
  status: 'success' | 'failure';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface MetricsSummary {
  serviceId: string;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  uptime: number; // percentage (0-100)
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
}

export interface MetricsParams {
  from?: string;
  to?: string;
  limit?: string;
}

export interface UptimeData {
  percentage: number;
  days: UptimeDay[];
}

export interface FailureWithService {
  id: number;
  serviceId: string;
  serviceName: string;
  status: 'failure';
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  checkedAt: string;
}

export interface ServiceUptimeSummary {
  serviceId: string;
  serviceName: string;
  uptime: number; // 0–100
  totalChecks: number;
  failures: number;
}

export interface UptimeDay {
  date: string;
  status: 'up' | 'down' | 'partial';
  uptime: number;
}

export interface UptimeParams {
  days?: string;
}

export interface LinkedRequest {
  id: number;
  method: string;
  path: string;
  statusCode: number;
  isError: boolean;
}

export interface LogEntry {
  id: number;
  serviceId: string;
  serviceName?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  source?: 'internal' | 'otlp';
  fingerprint?: string;
  traceId?: string;
  spanId?: string;
  createdAt: string;
  linkedRequest?: LinkedRequest;
}

export interface LogsParams {
  level?: string;
  from?: string;
  to?: string;
  limit?: string;
  traceId?: string;
}

export interface Incident {
  id: string;
  serviceId: string;
  serviceName?: string;
  type: string;
  message: string;
  startedAt: string;
  resolvedAt?: string;
}

export interface HealthStatus {
  status: 'healthy';
  version: string;
  uptime: string;
  database: 'connected' | 'disconnected';
  activeServices: number;
}

export interface ApiRequest {
  id: number;
  serviceId: string;
  requestId: string;
  method: string;
  path: string;
  pathTemplate: string;
  route?: string;
  serviceName?: string;
  traceId?: string;
  spanId?: string;
  statusCode: number;
  durationMs: number;
  clientIp?: string;
  error?: string;
  isError: boolean;
  createdAt: string;
}

export interface TraceSpan {
  id: number;
  serviceId?: string;
  serviceName?: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startUnixNano: number;
  endUnixNano: number;
  durationMs: number;
  statusCode?: string;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  createdAt: string;
}

export interface TraceDetail {
  traceId: string;
  spans: TraceSpan[];
  logs: LogEntry[];
  apiRequests: ApiRequest[];
}

export interface ApiRequestListParams {
  limit?: number;
  offset?: number;
  errorsOnly?: boolean;
  method?: string;
  minStatus?: number;
  maxStatus?: number;
  pathPrefix?: string;
  search?: string;
  from?: string;
  to?: string;
  traceId?: string;
}

export interface ApiRequestListResponse {
  items: ApiRequest[];
  total: number;
}

// --- API ---

export function createServicesApi(request: RequestFn) {
  return {
    // Services CRUD
    getServices: async (typeFilter?: string[]) => {
      const query = typeFilter?.length ? `?type=${typeFilter.join(',')}` : '';
      const data = await request<Service[]>(`/services${query}`);
      return data || [];
    },

    getServiceById: (id: string) =>
      request<Service>(`/services/${id}`),

    createService: (data: CreateServiceData) =>
      request<Service>('/services', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateService: (id: string, data: Partial<CreateServiceData>) =>
      request<Service>(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteService: (id: string) =>
      request<void>(`/services/${id}`, { method: 'DELETE' }),

    pauseService: (id: string) =>
      request<Service>(`/services/${id}/pause`, { method: 'POST' }),

    resumeService: (id: string) =>
      request<Service>(`/services/${id}/resume`, { method: 'POST' }),

    regenerateServiceApiKey: (id: string) =>
      request<{ apiKey: string; apiKeyMasked: string }>(
        `/services/${id}/regenerate-key`,
        { method: 'POST' }
      ),

    // Metrics
    getServiceMetrics: async (serviceId: string, params?: MetricsParams) => {
      const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
      const data = await request<Metric[]>(`/services/${serviceId}/metrics${query}`);
      return data || [];
    },

    getServiceMetricsSummary: (serviceId: string) =>
      request<MetricsSummary>(`/services/${serviceId}/metrics/summary`),

    getServiceUptime: (serviceId: string, params?: UptimeParams) => {
      const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
      return request<UptimeData>(`/services/${serviceId}/uptime${query}`);
    },

    // Logs
    getLogs: async (params?: LogsParams) => {
      const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
      const data = await request<LogEntry[]>(`/logs${query}`);
      return data || [];
    },

    getServiceLogs: async (serviceId: string, params?: LogsParams) => {
      const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
      const data = await request<LogEntry[]>(`/services/${serviceId}/logs${query}`);
      return data || [];
    },

    // KPI summary
    getHealthCheckKpiSummary: () =>
      request<HealthCheckKpiSummary>('/metrics/kpi'),

    // Recent checks (success + failure) across all non-log services
    getRecentChecks: async (limit?: number) => {
      const query = limit ? `?limit=${limit}` : '';
      const data = await request<CheckEntry[]>(`/metrics/recent${query}`);
      return data || [];
    },

    // Global metrics aggregation
    getAllFailures: async (limit?: number) => {
      const query = limit ? `?limit=${limit}` : '';
      const data = await request<FailureWithService[]>(`/metrics/failures${query}`);
      return data || [];
    },

    getUptimeSummaryAll: async (days?: number) => {
      const query = days ? `?days=${days}` : '';
      const data = await request<ServiceUptimeSummary[]>(`/metrics/uptime-summary${query}`);
      return data || [];
    },

    // Incidents
    getIncidents: async () => {
      const data = await request<Incident[]>('/incidents');
      return data || [];
    },

    getActiveIncidents: async () => {
      const data = await request<Incident[]>('/incidents/active');
      return data || [];
    },

    // Health
    getHealth: () => request<HealthStatus>('/health'),

    // API Request Monitoring
    getServiceApiRequests: (serviceId: string, params?: ApiRequestListParams) => {
      const query = params
        ? (() => {
            const p = new URLSearchParams();
            if (params.limit !== undefined) p.set('limit', String(params.limit));
            if (params.offset !== undefined) p.set('offset', String(params.offset));
            if (params.errorsOnly !== undefined) p.set('errorsOnly', String(params.errorsOnly));
            if (params.method !== undefined) p.set('method', params.method);
            if (params.minStatus !== undefined) p.set('minStatus', String(params.minStatus));
            if (params.maxStatus !== undefined) p.set('maxStatus', String(params.maxStatus));
            if (params.pathPrefix !== undefined) p.set('pathPrefix', params.pathPrefix);
            if (params.search !== undefined) p.set('search', params.search);
            if (params.from !== undefined) p.set('from', params.from);
            if (params.to !== undefined) p.set('to', params.to);
            if (params.traceId !== undefined) p.set('traceId', params.traceId);
            const s = p.toString();
            return s ? `?${s}` : '';
          })()
        : '';
      return request<ApiRequestListResponse>(`/services/${serviceId}/api-requests${query}`);
    },

    getApiRequestById: (serviceId: string, requestId: number) =>
      request<ApiRequest>(`/services/${serviceId}/api-requests/${requestId}`),

    getTrace: (traceId: string) =>
      request<TraceDetail>(`/traces/${traceId}`),
  };
}
