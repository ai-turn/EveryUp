import type { RequestFn } from './base';
import type { Resource } from '../../types/infra';

// --- Types ---

export interface Host {
  id: string;
  name: string;
  type: 'local' | 'remote';
  resourceCategory?: 'server' | 'database' | 'container';
  ip: string;
  port?: number;
  group: string;
  isActive: boolean;
  status: 'online' | 'offline' | 'unknown' | 'error';
  description?: string;
  sshUser?: string;
  sshPort?: number;
  sshAuthType?: 'password' | 'key' | 'key_file';
  sshKeyPath?: string;
  sshKey?: string;
  sshPassword?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHostData {
  id: string;
  name: string;
  type: 'local' | 'remote';
  resourceCategory?: 'server' | 'database' | 'container';
  ip: string;
  port?: number;
  group?: string;
  description?: string;
  sshUser?: string;
  sshPort?: number;
  sshAuthType?: 'password' | 'key' | 'key_file';
  sshKeyPath?: string;
  sshKey?: string;
  sshPassword?: string;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  platform: string;
  kernel?: string;
  uptime: number;
  ip: string;
  cpu: { cores: number; usage: number };
  memory: { total: number; used: number; usage: number };
  disk: { total: number; used: number; usage: number; readSpeed: number; writeSpeed: number };
  network: { in: number; out: number }; // MB/s
}

export interface SystemMetricPoint {
  timestamp: string;
  cpu: number;
  memUsed: number;
  memCached: number;
  diskRead: number;
  diskWrite: number;
  netIn: number;
  netOut: number;
}

export interface SystemMetricsHistory {
  range: string;
  points: SystemMetricPoint[];
}

export interface SystemProcess {
  pid: number;
  name: string;
  cpu: number;
  memory: string;
  memoryBytes: number;
  status: string;
}

// --- API ---

export function createHostsApi(request: RequestFn) {
  return {
    // Hosts CRUD
    getHosts: async () => {
      const data = await request<Host[]>('/hosts');
      return data || [];
    },

    getHostSummaries: async () => {
      const data = await request<Resource[]>('/hosts/summary');
      return data || [];
    },

    getHostById: (id: string) =>
      request<Host>(`/hosts/${id}`),

    createHost: (data: CreateHostData) =>
      request<Host>('/hosts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateHost: (id: string, data: Partial<CreateHostData>) =>
      request<Host>(`/hosts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteHost: (id: string) =>
      request<void>(`/hosts/${id}`, { method: 'DELETE' }),

    pauseHost: (id: string) =>
      request<void>(`/hosts/${id}/pause`, { method: 'POST' }),

    resumeHost: (id: string) =>
      request<void>(`/hosts/${id}/resume`, { method: 'POST' }),

    // System Resource Monitoring (host-scoped)
    getSystemInfo: (hostId: string) =>
      request<SystemInfo>(`/hosts/${hostId}/system/info`),

    getSystemMetricsHistory: (hostId: string, range?: string) => {
      const query = range ? `?range=${range}` : '';
      return request<SystemMetricsHistory>(`/hosts/${hostId}/system/metrics${query}`);
    },

    getSystemProcesses: async (hostId: string, limit?: number, sort?: string) => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (sort) params.set('sort', sort);
      const query = params.toString() ? `?${params}` : '';
      const data = await request<SystemProcess[]>(`/hosts/${hostId}/system/processes${query}`);
      return data || [];
    },

  };
}
