// API Service Layer
import { env } from '../config/env';
import { mockRouter } from './mockRouter';

// API 응답 표준 래퍼 타입
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
  };
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.apiBaseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    if (env.useMock) return mockRouter<T>(endpoint, options?.method);

    const token = localStorage.getItem('everyup_jwt_token');
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      localStorage.removeItem('everyup_jwt_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const json: ApiResponse<T> = await response.json();

    // success 필드 검증
    if (!json.success) {
      throw new Error(json.error?.message || 'API Error');
    }

    // data 필드 추출 (unwrap)
    return json.data as T;
  }

  // Dashboard
  async getDashboardSummary() {
    return this.request<DashboardSummary>('/dashboard/summary');
  }

  async getDashboardTimeline() {
    const data = await this.request<TimelineItem[]>('/dashboard/timeline');
    return data || [];
  }

  // Services
  async getServices(typeFilter?: string[]) {
    const query = typeFilter?.length ? `?type=${typeFilter.join(',')}` : '';
    const data = await this.request<Service[]>(`/services${query}`);
    return data || [];
  }

  async getServiceById(id: string) {
    return this.request<Service>(`/services/${id}`);
  }

  async createService(data: CreateServiceData) {
    return this.request<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateService(id: string, data: Partial<CreateServiceData>) {
    return this.request<Service>(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteService(id: string) {
    return this.request<void>(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  async pauseService(id: string) {
    return this.request<Service>(`/services/${id}/pause`, {
      method: 'POST',
    });
  }

  async resumeService(id: string) {
    return this.request<Service>(`/services/${id}/resume`, {
      method: 'POST',
    });
  }

  async regenerateServiceApiKey(id: string) {
    return this.request<{ apiKey: string; apiKeyMasked: string }>(`/services/${id}/regenerate-key`, {
      method: 'POST',
    });
  }

  // Metrics
  async getServiceMetrics(serviceId: string, params?: MetricsParams) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    const data = await this.request<Metric[]>(`/services/${serviceId}/metrics${query}`);
    return data || [];
  }

  async getServiceMetricsSummary(serviceId: string) {
    return this.request<MetricsSummary>(`/services/${serviceId}/metrics/summary`);
  }

  async getServiceUptime(serviceId: string, params?: UptimeParams) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return this.request<UptimeData>(`/services/${serviceId}/uptime${query}`);
  }

  // Logs
  async getLogs(params?: LogsParams) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    const data = await this.request<LogEntry[]>(`/logs${query}`);
    return data || [];
  }

  async getServiceLogs(serviceId: string, params?: LogsParams) {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    const data = await this.request<LogEntry[]>(`/services/${serviceId}/logs${query}`);
    return data || [];
  }

  // Incidents
  async getIncidents() {
    const data = await this.request<Incident[]>('/incidents');
    return data || [];
  }

  async getActiveIncidents() {
    const data = await this.request<Incident[]>('/incidents/active');
    return data || [];
  }

  // Health
  async getHealth() {
    return this.request<HealthStatus>('/health');
  }

  // Notifications
  async getNotificationChannels() {
    const data = await this.request<NotificationChannel[]>('/notifications');
    return data || [];
  }

  async createNotificationChannel(data: CreateNotificationChannelData) {
    return this.request<NotificationChannel>('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNotificationChannel(id: string, data: CreateNotificationChannelData) {
    return this.request<NotificationChannel>(`/notifications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async toggleNotificationChannel(id: string) {
    return this.request<{ id: string; isEnabled: boolean }>(`/notifications/${id}/toggle`, {
      method: 'POST',
    });
  }

  async testNotificationChannel(id: string) {
    return this.request<{ message: string }>(`/notifications/${id}/test`, {
      method: 'POST',
    });
  }

  async deleteNotificationChannel(id: string) {
    return this.request<void>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // Hosts
  async getHosts() {
    const data = await this.request<Host[]>('/hosts');
    return data || [];
  }

  async getHostById(id: string) {
    return this.request<Host>(`/hosts/${id}`);
  }

  async createHost(data: CreateHostData) {
    return this.request<Host>('/hosts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateHost(id: string, data: Partial<CreateHostData>) {
    return this.request<Host>(`/hosts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteHost(id: string) {
    return this.request<void>(`/hosts/${id}`, {
      method: 'DELETE',
    });
  }

  async pauseHost(id: string) {
    return this.request<void>(`/hosts/${id}/pause`, { method: 'POST' });
  }

  async resumeHost(id: string) {
    return this.request<void>(`/hosts/${id}/resume`, { method: 'POST' });
  }

  // System Resource Monitoring (host-scoped)
  async getSystemInfo(hostId: string) {
    return this.request<SystemInfo>(`/hosts/${hostId}/system/info`);
  }

  async getSystemMetricsHistory(hostId: string, range?: string) {
    const query = range ? `?range=${range}` : '';
    return this.request<SystemMetricsHistory>(`/hosts/${hostId}/system/metrics${query}`);
  }

  async getSystemProcesses(hostId: string, limit?: number, sort?: string) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (sort) params.set('sort', sort);
    const query = params.toString() ? `?${params}` : '';
    const data = await this.request<SystemProcess[]>(`/hosts/${hostId}/system/processes${query}`);
    return data || [];
  }

  // SSH Connection Test
  async testSSHConnection(data: Partial<CreateHostData>) {
    return this.request<SSHTestResult>('/hosts/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Alert Rules
  async getAlertRules() {
    const data = await this.request<AlertRule[]>('/alert-rules');
    return data || [];
  }

  async getAlertRuleById(id: string) {
    return this.request<AlertRule>(`/alert-rules/${id}`);
  }

  async createAlertRule(data: CreateAlertRuleData) {
    return this.request<AlertRule>('/alert-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAlertRule(id: string, data: UpdateAlertRuleData) {
    return this.request<AlertRule>(`/alert-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAlertRule(id: string) {
    return this.request<void>(`/alert-rules/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleAlertRule(id: string) {
    return this.request<{ id: string; isEnabled: boolean }>(`/alert-rules/${id}/toggle`, {
      method: 'POST',
    });
  }

  // Notification History
  async getNotificationHistory(filter?: NotificationHistoryFilter) {
    const params = new URLSearchParams();
    if (filter?.channel_id) params.append('channel_id', filter.channel_id);
    if (filter?.alert_type) params.append('alert_type', filter.alert_type);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.from) params.append('from', filter.from);
    if (filter?.to) params.append('to', filter.to);
    if (filter?.limit) params.append('limit', filter.limit.toString());
    if (filter?.offset) params.append('offset', filter.offset.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/notification-history?${queryString}` : '/notification-history';
    return this.request<NotificationHistoryResponse>(endpoint);
  }

  async getNotificationHistoryStats(days: number = 7) {
    return this.request<NotificationStats>(`/notification-history/stats?days=${days}`);
  }

  async getNotificationHistoryById(id: number) {
    return this.request<NotificationHistory>(`/notification-history/${id}`);
  }

  async cleanupNotificationHistory(days: number = 30) {
    return this.request<{ deleted: number }>(`/notification-history/cleanup?days=${days}`, {
      method: 'DELETE',
    });
  }

  // Settings
  async getSettings() {
    return this.request<AppSettings>('/settings');
  }

  async updateSettings(settings: Partial<AppSettings>) {
    return this.request<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

export const api = new ApiService();

// Types
export interface DashboardSummary {
  totalServices: number;
  healthyServices: number;
  unhealthyServices: number;
  avgResponseTime: number;
  overallUptime: number;
  criticalAlerts: number;
  /** Set when exactly one active incident exists — service to navigate to */
  criticalServiceId?: string;
}

export interface TimelineItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  serviceId?: string;
  serviceName?: string;
}

export interface Service {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'log';
  url?: string;
  host?: string;
  port?: number;
  method?: string;
  interval: number;
  timeout: number;
  expectedStatus?: number;
  isActive: boolean;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastCheckedAt?: string;
  tags?: string[];
  apiKey?: string;
  apiKeyMasked?: string;
  uptime?: number;
  responseTime?: number;
  scheduleType: 'interval' | 'cron';
  cronExpression?: string;
}

export interface CreateServiceData {
  name: string;
  type: 'http' | 'tcp' | 'log';
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
}

export interface Metric {
  id: string;
  serviceId: string;
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  statusCode?: number;
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
  id: string;
  serviceId: string;
  serviceName?: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  source?: 'internal' | 'external';
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
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  uptime: number;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'telegram' | 'discord';
  config: string; // JSON string
  isEnabled: boolean;
  createdAt: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface DiscordConfig {
  webhookUrl: string;
}

export interface CreateNotificationChannelData {
  name: string;
  type: 'telegram' | 'discord';
  config: TelegramConfig | DiscordConfig;
}

// Host Types
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

export interface SSHTestResult {
  connected: boolean;
  hostname?: string;
  os?: string;
  platform?: string;
  latencyMs: number;
}

// System Resource Monitoring Types
export interface SystemInfo {
  hostname: string;
  os: string;
  platform: string;
  uptime: number;
  ip: string;
  cpu: { cores: number; usage: number };
  memory: { total: number; used: number; usage: number };
  disk: { total: number; used: number; usage: number; readSpeed: number; writeSpeed: number };
}

export interface SystemMetricPoint {
  timestamp: string;
  cpu: number;
  memUsed: number;
  memCached: number;
  diskRead: number;
  diskWrite: number;
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

// Alert Rule Types
export type AlertRuleType = 'resource' | 'service' | 'system';
export type AlertMetric = 'cpu' | 'memory' | 'disk' | 'status_change' | 'http_status' | 'response_time';
export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertRule {
  id: string;
  name: string;
  type: AlertRuleType;
  hostId?: string | null;
  serviceId?: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  duration: number;
  severity: AlertSeverity;
  isEnabled: boolean;
  isSystem: boolean;
  cooldown: number;
  message?: string;
  channelIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRuleData {
  name: string;
  type: AlertRuleType;
  hostId?: string | null;
  serviceId?: string | null;
  metric: AlertMetric;
  operator?: AlertOperator;
  threshold: number;
  duration?: number;
  severity?: AlertSeverity;
  isEnabled?: boolean;
  cooldown?: number;
  message?: string;
  channelIds?: string[];
}

export interface UpdateAlertRuleData {
  name?: string;
  hostId?: string | null;
  serviceId?: string | null;
  metric?: AlertMetric;
  operator?: AlertOperator;
  threshold?: number;
  duration?: number;
  severity?: AlertSeverity;
  isEnabled?: boolean;
  cooldown?: number;
  message?: string;
  channelIds?: string[];
}

// Notification History Types
export type NotificationStatus = 'sent' | 'failed' | 'pending';
export type NotificationAlertType = 'resource' | 'healthcheck' | 'log' | 'scheduled';

export interface NotificationHistory {
  id: number;
  ruleId?: string;
  channelId: string;
  channelName: string;
  channelType: string;
  alertType: NotificationAlertType;
  severity?: string;
  hostId?: string;
  hostName?: string;
  serviceId?: string;
  serviceName?: string;
  message: string;
  status: NotificationStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  sentAt?: string;
}

export interface NotificationHistoryFilter {
  channel_id?: string;
  alert_type?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationHistoryResponse {
  items: NotificationHistory[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  byChannel: Record<string, number>;
  byAlertType: Record<string, number>;
}

export interface AppSettings {
  alerts: {
    consecutiveFailures: number;
  };
  retention: {
    metrics: string;
    logs: string;
  };
}

