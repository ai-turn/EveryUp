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

export function createAgentsApi(request: RequestFn) {
  return {
    getAgents: () => request<ConnectedAgent[]>('/agents'),
    getAgentServices: (agentId: string) => request<AgentServiceSnapshot[]>(`/agents/${agentId}/services`),
    getAgentEvents: (agentId: string, limit = 100) =>
      request<AgentEvent[]>(`/agents/${agentId}/events?limit=${limit}`),
  };
}
