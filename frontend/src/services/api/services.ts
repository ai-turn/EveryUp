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

export interface UptimeDay {
  date: string;
  status: 'up' | 'down' | 'partial';
  uptime: number;
}

export interface UptimeParams {
  days?: string;
}

export interface LogEntry {
  id: number;
  serviceId: string;
  serviceName?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  source?: 'internal' | 'external' | 'agent';
  fingerprint?: string;
  createdAt: string;
}

export interface LogsParams {
  level?: string;
  from?: string;
  to?: string;
  limit?: string;
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

export type ApiCaptureMode = 'disabled' | 'errors_only' | 'sampled' | 'all';

export interface ApiRequest {
  id: number;
  serviceId: string;
  requestId: string;
  method: string;
  path: string;
  pathTemplate: string;
  statusCode: number;
  durationMs: number;
  clientIp?: string;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
  reqBodySize: number;
  resHeaders?: Record<string, string>;
  resBody?: string;
  resBodySize: number;
  error?: string;
  isError: boolean;
  createdAt: string;
}

export interface ApiCaptureConfig {
  mode: ApiCaptureMode;
  sampleRate: number;
  bodyMaxBytes: number;
  maskedHeaders: string[];
  maskedBodyFields: string[];
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
            const s = p.toString();
            return s ? `?${s}` : '';
          })()
        : '';
      return request<ApiRequestListResponse>(`/services/${serviceId}/api-requests${query}`);
    },

    getApiRequestById: (serviceId: string, requestId: number) =>
      request<ApiRequest>(`/services/${serviceId}/api-requests/${requestId}`),

    getApiCaptureConfig: (serviceId: string) =>
      request<ApiCaptureConfig>(`/services/${serviceId}/api-capture-config`),

    updateApiCaptureConfig: (serviceId: string, config: ApiCaptureConfig) =>
      request<ApiCaptureConfig>(`/services/${serviceId}/api-capture-config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
  };
}
