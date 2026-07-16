import { request } from './base';

// --- Types ---

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

// --- API ---

export const hostsApi = {
  // System Resource Monitoring (host-scoped)
  getSystemInfo: (hostId: string) =>
    request<SystemInfo>(`/hosts/${hostId}/system/info`),

  getSystemMetricsHistory: (hostId: string, range?: string) => {
    const query = range ? `?range=${range}` : '';
    return request<SystemMetricsHistory>(`/hosts/${hostId}/system/metrics${query}`);
  },
};
