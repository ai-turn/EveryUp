import type { RequestFn } from './base';

// --- Alert Rule Types ---

export type AlertRuleType = 'resource' | 'service' | 'log' | 'system';
export type AlertMetric = 'cpu' | 'memory' | 'disk' | 'status_change' | 'http_status' | 'response_time' | 'log_level';
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

// --- Notification Channel Types ---

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'telegram' | 'discord' | 'slack';
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

export interface SlackConfig {
  webhookUrl: string;
}

export interface CreateNotificationChannelData {
  name: string;
  type: 'telegram' | 'discord' | 'slack';
  config: TelegramConfig | DiscordConfig | SlackConfig;
}

// --- Notification History Types ---

export type NotificationStatus = 'sent' | 'failed' | 'pending';
export type NotificationAlertType = 'resource' | 'healthcheck' | 'log' | 'scheduled' | 'endpoint';

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

// --- Settings Types ---

export interface AppSettings {
  alerts: {
    consecutiveFailures: number;
  };
  retention: {
    metrics: string;
    logs: string;
  };
}

// --- API ---

export function createAlertsApi(request: RequestFn) {
  return {
    // Alert Rules
    getAlertRules: async () => {
      const data = await request<AlertRule[]>('/alert-rules');
      return data || [];
    },

    getAlertRuleById: (id: string) =>
      request<AlertRule>(`/alert-rules/${id}`),

    createAlertRule: (data: CreateAlertRuleData) =>
      request<AlertRule>('/alert-rules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateAlertRule: (id: string, data: UpdateAlertRuleData) =>
      request<AlertRule>(`/alert-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    deleteAlertRule: (id: string) =>
      request<void>(`/alert-rules/${id}`, { method: 'DELETE' }),

    toggleAlertRule: (id: string) =>
      request<{ id: string; isEnabled: boolean }>(`/alert-rules/${id}/toggle`, {
        method: 'POST',
      }),

    // Notification Channels
    getNotificationChannels: async () => {
      const data = await request<NotificationChannel[]>('/notifications');
      return data || [];
    },

    createNotificationChannel: (data: CreateNotificationChannelData) =>
      request<NotificationChannel>('/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateNotificationChannel: (id: string, data: CreateNotificationChannelData) =>
      request<NotificationChannel>(`/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    toggleNotificationChannel: (id: string) =>
      request<{ id: string; isEnabled: boolean }>(`/notifications/${id}/toggle`, {
        method: 'POST',
      }),

    testNotificationChannel: (id: string) =>
      request<{ message: string }>(`/notifications/${id}/test`, {
        method: 'POST',
      }),

    deleteNotificationChannel: (id: string) =>
      request<void>(`/notifications/${id}`, { method: 'DELETE' }),

    // Notification History
    getNotificationHistory: (filter?: NotificationHistoryFilter) => {
      const params = new URLSearchParams();
      if (filter?.channel_id) params.append('channel_id', filter.channel_id);
      if (filter?.alert_type) params.append('alert_type', filter.alert_type);
      if (filter?.status) params.append('status', filter.status);
      if (filter?.from) params.append('from', filter.from);
      if (filter?.to) params.append('to', filter.to);
      if (filter?.limit) params.append('limit', filter.limit.toString());
      if (filter?.offset) params.append('offset', filter.offset.toString());

      const queryString = params.toString();
      const endpoint = queryString
        ? `/notification-history?${queryString}`
        : '/notification-history';
      return request<NotificationHistoryResponse>(endpoint);
    },

    getNotificationHistoryStats: (days: number = 7) =>
      request<NotificationStats>(`/notification-history/stats?days=${days}`),

    getNotificationHistoryById: (id: number) =>
      request<NotificationHistory>(`/notification-history/${id}`),

    cleanupNotificationHistory: (days: number = 30) =>
      request<{ deleted: number }>(`/notification-history/cleanup?days=${days}`, {
        method: 'DELETE',
      }),

    // Settings
    getSettings: () => request<AppSettings>('/settings'),

    updateSettings: (settings: Partial<AppSettings>) =>
      request<AppSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),

    resetAccount: () => request<void>('/auth/reset', { method: 'POST' }),
  };
}
