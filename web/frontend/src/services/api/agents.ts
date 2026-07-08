import type { LogEntry, ApiRequest } from './services';
import type { RequestFn } from './base';

export interface ConnectedAgent {
  id: string;
  name: string;
  mode: string;
  version?: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentServiceSnapshot {
  agentId: string;
  key: string;
  name: string;
  checkType: string;
  endpoint: string;
  /** Agent-detected language runtime ("java", "node", "python", "go", "dotnet"). */
  runtime?: string;
  /** Container image ref incl tag (docker-discovered services only). */
  image?: string;
  /** Docker container restart count; >0 hints a crash/restart loop. */
  restartCount?: number;
  /** Container start time (ISO); UI derives uptime. Absent/zero for non-container services. */
  startedAt?: string;
  healthy: boolean;
  seen: boolean;
  silenced: boolean;
  lastError?: string;
  lastStatus?: number;
  lastLatency?: string;
  updatedAt?: string;
  observedAt: string;
}

// AgentServiceFlat adds agentName from the joined agents table.
export interface AgentServiceFlat extends AgentServiceSnapshot {
  agentName: string;
}

export interface AgentEvent {
  id: number;
  agentId: string;
  time: string;
  type: string;
  serviceName?: string;
  targetKey?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// One time-bucketed data point for the response-time chart.
export interface ServiceHistoryPoint {
  time: string;
  latencyMs: number;
  uptimePct: number;
  total: number;
}

// Per-day uptime for the 90-day calendar.
export interface ServiceUptimeDay {
  date: string;
  uptimePct: number;
  healthyChecks: number;
  totalChecks: number;
}

// Per-project KPI rollup for the home project cards (one row per agent).
export interface AgentOverview {
  agentId: string;
  uptimePct: number | null; // 30d weighted, null when no checks yet
  activeIncidents: number;
  requests24h: number;
  p95Ms: number | null; // latest timed bucket, null when no latency data
}

// One unhealthy episode derived from service history (project dashboard).
export interface AgentIncident {
  key: string;
  serviceName: string;
  startedAt: string;
  endedAt?: string; // absent while still unhealthy
  durationSec: number;
  active: boolean;
}

// One time bucket of API request aggregates for the trends chart.
export interface ApiRequestStatBucket {
  time: string;
  count: number;
  errorCount: number;
  p50: number;
  p95: number;
  timed: number;
}

// One time bucket of per-level log counts for the logs-tab volume histogram.
export interface LogHistogramBucket {
  time: string;
  error: number;
  warn: number;
  info: number;
  debug: number;
  trace: number;
}

// Status-class distribution + most frequent 5xx endpoint over a window.
export interface ApiRequestStatusSummary {
  count2xx: number;
  count3xx: number;
  count4xx: number;
  count5xx: number;
  countOther: number;
  top5xxMethod?: string;
  top5xxPath?: string;
  top5xxCount?: number;
}

// One OTLP metric a service exports (for the metric picker).
export interface OtelMetricName {
  metricName: string;
  metricType: 'gauge' | 'sum' | 'histogram';
  unit?: string;
  lastAt: string;
}

// One OTLP metric data point. Histogram-family points carry count/total with
// value = average.
export interface OtelMetricPoint {
  id: number;
  metricName: string;
  metricType: string;
  unit?: string;
  attributes?: Record<string, unknown>;
  value: number;
  count?: number;
  total?: number;
  createdAt: string;
}

// A service's representative metric (latest value) for the project overview
// cards. Chosen server-side from whatever the service exports.
export interface OtelServiceMetric {
  serviceName: string;
  metricName: string;
  metricType: string;
  unit?: string;
  value: number;
}

export function createAgentsApi(request: RequestFn) {
  return {
    createAgent: (name: string) =>
      request<{ id: string; name: string; apiKey: string }>('/agents', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    deleteAgent: (agentId: string) =>
      request<void>(`/agents/${agentId}`, { method: 'DELETE' }),
    // Remove a single service card. Reappears on next sync if the agent still
    // reports this target (i.e. it's live, not a stale/zombie one).
    deleteAgentService: (agentId: string, key: string) =>
      request<void>(`/agents/${agentId}/services/${encodeURIComponent(key)}`, { method: 'DELETE' }),
    // Reveal the full API key. available=false for projects created before key storage existed.
    getAgentKey: (agentId: string) =>
      request<{ apiKey: string; available: boolean }>(`/agents/${agentId}/key`),
    rotateAgentKey: (agentId: string) =>
      request<{ apiKey: string }>(`/agents/${agentId}/rotate-key`, { method: 'POST' }),
    getAgents: () => request<ConnectedAgent[]>('/agents'),
    // Home project cards: per-agent KPI rollup in one call (no N+1).
    getAgentsOverview: () => request<AgentOverview[]>('/agents/overview'),
    getAgentServices: (agentId: string) => request<AgentServiceSnapshot[]>(`/agents/${agentId}/services`),
    getAgentEvents: (agentId: string, limit = 100) =>
      request<AgentEvent[]>(`/agents/${agentId}/events?limit=${limit}`),
    // Healthcheck page — Agent-based
    getAllAgentServicesFlat: () => request<AgentServiceFlat[]>('/agents/services/all'),
    getAgentServiceHistory: (agentId: string, key: string, range = '24h') =>
      request<ServiceHistoryPoint[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/history?range=${range}`),
    getAgentServiceUptime: (agentId: string, key: string, days = 90) =>
      request<ServiceUptimeDay[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/uptime?days=${days}`),
    getAgentServiceKeyEvents: (agentId: string, key: string, limit = 50) =>
      request<AgentEvent[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/events?limit=${limit}`),
    getAgentServiceLogs: (
      agentId: string, key: string,
      params?: { level?: string; search?: string; from?: string; to?: string; limit?: number; offset?: number },
    ) => {
      const p = new URLSearchParams();
      p.set('limit', String(params?.limit ?? 100));
      if (params?.offset) p.set('offset', String(params.offset));
      if (params?.level) p.set('level', params.level);
      if (params?.search) p.set('search', params.search);
      if (params?.from) p.set('from', params.from);
      if (params?.to) p.set('to', params.to);
      return request<{ data: LogEntry[]; total: number }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/logs?${p}`);
    },
    // Per-level log counts bucketed over time (logs-tab volume histogram).
    getAgentServiceLogHistogram: (
      agentId: string, key: string,
      params?: { level?: string; search?: string; from?: string; to?: string; bucketMins?: number },
    ) => {
      const p = new URLSearchParams();
      if (params?.level) p.set('level', params.level);
      if (params?.search) p.set('search', params.search);
      if (params?.from) p.set('from', params.from);
      if (params?.to) p.set('to', params.to);
      if (params?.bucketMins) p.set('bucketMins', String(params.bucketMins));
      return request<LogHistogramBucket[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/log-histogram?${p}`);
    },
    getAgentServiceRequests: (
      agentId: string, key: string,
      params?: { search?: string; errorsOnly?: boolean; from?: string; to?: string; limit?: number; offset?: number },
    ) => {
      const p = new URLSearchParams();
      p.set('limit', String(params?.limit ?? 100));
      if (params?.offset) p.set('offset', String(params.offset));
      if (params?.search) p.set('search', params.search);
      if (params?.errorsOnly) p.set('errorsOnly', 'true');
      if (params?.from) p.set('from', params.from);
      if (params?.to) p.set('to', params.to);
      return request<{ data: ApiRequest[]; total: number }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/requests?${p}`);
    },
    getAgentServiceRequestStats: (
      agentId: string, key: string,
      params?: { from?: string; to?: string; bucketMins?: number },
    ) => {
      const p = new URLSearchParams();
      if (params?.from) p.set('from', params.from);
      if (params?.to) p.set('to', params.to);
      if (params?.bucketMins) p.set('bucketMins', String(params.bucketMins));
      return request<ApiRequestStatBucket[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/request-stats?${p}`);
    },
    // Project-level Requests trend: rolls up all of an agent's services.
    getAgentRequestStats: (
      agentId: string,
      params?: { from?: string; to?: string; bucketMins?: number },
    ) => {
      const p = new URLSearchParams();
      if (params?.from) p.set('from', params.from);
      if (params?.to) p.set('to', params.to);
      if (params?.bucketMins) p.set('bucketMins', String(params.bucketMins));
      return request<ApiRequestStatBucket[]>(`/agents/${agentId}/request-stats?${p}`);
    },
    // Status-class distribution + top 5xx endpoint. Omit key for the agent rollup.
    getRequestStatusSummary: (
      agentId: string, key?: string,
      params?: { from?: string; to?: string },
    ) => {
      const p = new URLSearchParams();
      if (params?.from) p.set('from', params.from);
      if (params?.to) p.set('to', params.to);
      const base = key
        ? `/agents/${agentId}/services/${encodeURIComponent(key)}/request-status-summary`
        : `/agents/${agentId}/request-status-summary`;
      return request<ApiRequestStatusSummary>(`${base}?${p}`);
    },
    // Project-level uptime rollup across all of the agent's services.
    getAgentUptime: (agentId: string, days = 90) =>
      request<ServiceUptimeDay[]>(`/agents/${agentId}/uptime?days=${days}`),
    // Unhealthy episodes derived from service history, newest first.
    getAgentIncidents: (agentId: string, days = 30, limit = 20) =>
      request<AgentIncident[]>(`/agents/${agentId}/incidents?days=${days}&limit=${limit}`),
    // Each service's representative metric (latest value) for the project cards.
    getAgentServiceMetrics: (agentId: string) =>
      request<OtelServiceMetric[]>(`/agents/${agentId}/service-metrics`),
    getAgentServiceOtelMetricNames: (agentId: string, key: string) =>
      request<OtelMetricName[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/otel-metrics`),
    getAgentServiceOtelMetricPoints: (
      agentId: string, key: string,
      params: { name: string; from?: string; to?: string; limit?: number },
    ) => {
      const p = new URLSearchParams();
      p.set('name', params.name);
      if (params.from) p.set('from', params.from);
      if (params.to) p.set('to', params.to);
      if (params.limit) p.set('limit', String(params.limit));
      return request<OtelMetricPoint[]>(`/agents/${agentId}/services/${encodeURIComponent(key)}/otel-metrics/points?${p}`);
    },
    // Per-service OTLP ingest filter: which log levels are stored. [] = accept all.
    getAgentServiceLogFilter: (agentId: string, key: string) =>
      request<{ levels: string[] }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/log-filter`),
    setAgentServiceLogFilter: (agentId: string, key: string, levels: string[]) =>
      request<{ levels: string[] }>(`/agents/${agentId}/services/${encodeURIComponent(key)}/log-filter`, {
        method: 'PUT',
        body: JSON.stringify({ levels }),
      }),
  };
}
