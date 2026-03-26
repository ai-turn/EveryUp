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
  logLevelFilter?: Array<'error' | 'warn' | 'info'>;
}

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
  logLevelFilter?: Array<'error' | 'warn' | 'info'>;
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
  level: 'info' | 'warn' | 'error';
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
  };
}
