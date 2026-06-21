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

export function createAgentsApi(request: RequestFn) {
  return {
    createAgent: (name: string) =>
      request<{ id: string; name: string; apiKey: string }>('/agents', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    deleteAgent: (agentId: string) =>
      request<void>(`/agents/${agentId}`, { method: 'DELETE' }),
    getAgents: () => request<ConnectedAgent[]>('/agents'),
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
  };
}
