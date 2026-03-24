/**
 * Mock router for demo mode.
 * Maps API endpoint patterns to mock data so ALL api.* calls (including direct
 * calls that bypass useDataFetch) return plausible data in demo/mock mode.
 */

import { mockServices } from '../mocks/dashboard/services.mock';
import { mockIncidents as mockDashboardIncidents } from '../mocks/dashboard/incidents.mock';
import { mockLogEntries as allMockLogs } from '../mocks/logs/logs.mock';
import { mockResponseTimeChartData } from '../mocks/healthcheck/charts.mock';
import { mockGauges } from '../mocks/infra';
import { mockResources } from '../mocks/infra/resourceList.mock';

import type {
  TimelineItem,
  Service,
  MetricsSummary,
  Metric,
  UptimeData,
  LogEntry,
  Incident,
  NotificationChannel,
  Host,
  SystemInfo,
  SystemMetricsHistory,
  SystemProcess,
  AlertRule,
  NotificationHistoryResponse,
  NotificationStats,
  AppSettings,
} from './api';

// ── Dashboard ────────────────────────────────────────────────────────────────

const mockTimeline: TimelineItem[] = mockDashboardIncidents.map((i) => ({
  id: i.id,
  type: i.type,
  message: i.message,
  timestamp: new Date().toISOString(),
  serviceName: i.serviceName,
}));

// ── Services ─────────────────────────────────────────────────────────────────

const mockApiServices: Service[] = mockServices.map((s) => ({
  id: s.id,
  name: s.name,
  type: 'http' as const,
  interval: 60,
  timeout: 10,
  isActive: true,
  status: s.status === 'healthy' ? 'healthy' : s.status === 'offline' ? 'unhealthy' : 'unknown',
  uptime: parseFloat(s.uptime?.replace('%', '') ?? '99'),
  responseTime: parseInt(s.latency?.replace('ms', '').replace(',', '') ?? '0', 10),
  tags: [],
  scheduleType: 'interval' as const,
}));

const mockLogServices: Service[] = [
  {
    id: '1',
    name: 'API Gateway',
    type: 'log' as const,
    interval: 0,
    timeout: 0,
    isActive: true,
    status: 'healthy',
    uptime: 99.8,
    responseTime: 0,
    tags: ['prod'],
    scheduleType: 'interval' as const,
    logLevelFilter: ['error', 'warn'],
  },
  {
    id: '2',
    name: 'Auth Service',
    type: 'log' as const,
    interval: 0,
    timeout: 0,
    isActive: true,
    status: 'unhealthy',
    uptime: 98.5,
    responseTime: 0,
    tags: ['prod'],
    scheduleType: 'interval' as const,
    logLevelFilter: ['error'],
  },
  {
    id: '5',
    name: 'Payment Worker',
    type: 'log' as const,
    interval: 0,
    timeout: 0,
    isActive: true,
    status: 'healthy',
    uptime: 99.9,
    responseTime: 0,
    tags: ['prod'],
    scheduleType: 'interval' as const,
    logLevelFilter: ['error', 'warn', 'info'],
  },
];

// ── Metrics ───────────────────────────────────────────────────────────────────

const mockMetricsSummary: MetricsSummary = {
  serviceId: '1',
  totalChecks: 45200,
  successfulChecks: 45191,
  failedChecks: 9,
  uptime: 99.98,
  avgResponseTime: 124,
  minResponseTime: 18,
  maxResponseTime: 890,
};

const mockMetrics: Metric[] = mockResponseTimeChartData.map((rt, i) => ({
  id: String(i + 1),
  serviceId: '1',
  status: 'success' as const,
  responseTime: rt * 10,
  statusCode: 200,
  checkedAt: new Date(Date.now() - (23 - i) * 3600_000).toISOString(),
}));

const mockUptimeData: UptimeData = {
  percentage: 99.98,
  days: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - (89 - i) * 86_400_000).toISOString().slice(0, 10),
    status: i === 42 || i === 77 ? ('partial' as const) : ('up' as const),
    uptime: i === 42 || i === 77 ? 94 : 100,
  })),
};

// ── Logs ──────────────────────────────────────────────────────────────────────

function filterLogs(endpoint: string, serviceId?: string): LogEntry[] {
  const [, qs] = endpoint.split('?');
  const params = new URLSearchParams(qs ?? '');
  const level = params.get('level') ?? '';
  const limit = parseInt(params.get('limit') ?? '50', 10);

  let logs = allMockLogs;
  if (serviceId) logs = logs.filter(l => l.serviceId === serviceId);
  if (level && level !== 'all') logs = logs.filter(l => l.level === level);
  return logs.slice(0, limit);
}

// ── Incidents ─────────────────────────────────────────────────────────────────

const mockIncidentList: Incident[] = [
  {
    id: '1',
    serviceId: '2',
    serviceName: 'Auth Service',
    type: 'degraded',
    message: 'Response time exceeded threshold',
    startedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    resolvedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
];

// ── Notifications ─────────────────────────────────────────────────────────────

const mockChannels: NotificationChannel[] = [
  {
    id: '1',
    name: 'Ops Telegram',
    type: 'telegram',
    config: JSON.stringify({ botToken: '***', chatId: '-100123456' }),
    isEnabled: true,
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  },
  {
    id: '2',
    name: '#alerts Discord',
    type: 'discord',
    config: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/...' }),
    isEnabled: true,
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  },
  {
    id: '3',
    name: '#incidents Slack',
    type: 'slack',
    config: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/...' }),
    isEnabled: true,
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  },
];

// ── Hosts ─────────────────────────────────────────────────────────────────────

const mockHosts: Host[] = mockResources.map((r) => ({
  id: r.id,
  name: r.name,
  type: 'remote' as const,
  resourceCategory: r.type,
  ip: r.ip,
  group: r.cluster,
  isActive: r.status !== 'critical',
  status: r.status === 'healthy' ? 'online' : r.status === 'critical' ? 'error' : 'unknown',
  createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
}));

// ── System Resource Monitoring ────────────────────────────────────────────────

const mockSystemInfo: SystemInfo = {
  hostname: 'prod-server-01',
  os: 'Ubuntu 22.04 LTS',
  platform: 'linux',
  uptime: 1_234_567,
  ip: '192.168.1.50',
  cpu: { cores: 8, usage: mockGauges[0]?.percentage ?? 42 },
  memory: { total: 16, used: 9.6, usage: mockGauges[1]?.percentage ?? 60 },
  disk: { total: 500, used: 210, usage: mockGauges[2]?.percentage ?? 42, readSpeed: 120, writeSpeed: 80 },
};

const mockSystemMetrics: SystemMetricsHistory = {
  range: '6h',
  points: Array.from({ length: 72 }, (_, i) => ({
    timestamp: new Date(Date.now() - (71 - i) * 5 * 60_000).toISOString(),
    cpu: 30 + Math.sin(i / 8) * 20 + Math.random() * 5,
    memUsed: 55 + Math.cos(i / 10) * 10 + Math.random() * 3,
    memCached: 10 + Math.random() * 5,
    diskRead: 50 + Math.random() * 100,
    diskWrite: 30 + Math.random() * 80,
  })),
};

const mockProcesses: SystemProcess[] = [
  { pid: 1234, name: 'node', cpu: 12.4, memory: '512 MB', memoryBytes: 536_870_912, status: 'running' },
  { pid: 5678, name: 'postgres', cpu: 8.1, memory: '1.2 GB', memoryBytes: 1_288_490_189, status: 'running' },
  { pid: 9012, name: 'redis-server', cpu: 2.3, memory: '256 MB', memoryBytes: 268_435_456, status: 'running' },
  { pid: 3456, name: 'nginx', cpu: 1.1, memory: '64 MB', memoryBytes: 67_108_864, status: 'running' },
  { pid: 7890, name: 'prometheus', cpu: 3.7, memory: '384 MB', memoryBytes: 402_653_184, status: 'running' },
];

// ── Alert Rules ───────────────────────────────────────────────────────────────

const mockAlertRules: AlertRule[] = [
  {
    id: '1',
    name: 'High CPU Usage',
    type: 'resource',
    hostId: 'prod-db-01',
    metric: 'cpu',
    operator: 'gt',
    threshold: 85,
    duration: 300,
    severity: 'warning',
    isEnabled: true,
    isSystem: false,
    cooldown: 600,
    channelIds: ['1'],
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: '2',
    name: 'Service Down',
    type: 'service',
    serviceId: '2',
    metric: 'status_change',
    operator: 'eq',
    threshold: 0,
    duration: 60,
    severity: 'critical',
    isEnabled: true,
    isSystem: true,
    cooldown: 300,
    channelIds: ['1', '2', '3'],
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: '3',
    name: 'Memory Pressure',
    type: 'resource',
    hostId: 'worker-node-01',
    metric: 'memory',
    operator: 'gt',
    threshold: 90,
    duration: 180,
    severity: 'critical',
    isEnabled: true,
    isSystem: false,
    cooldown: 600,
    channelIds: ['2'],
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];

// ── Notification History ──────────────────────────────────────────────────────

const mockNotificationHistory: NotificationHistoryResponse = {
  items: [
    {
      id: 1,
      channelId: '1',
      channelName: 'Ops Telegram',
      channelType: 'telegram',
      alertType: 'resource',
      severity: 'warning',
      hostId: 'prod-db-01',
      hostName: 'Production-DB-01',
      message: 'CPU usage exceeded 85% for 5 minutes',
      status: 'sent',
      retryCount: 0,
      createdAt: new Date(Date.now() - 1 * 3600_000).toISOString(),
      sentAt: new Date(Date.now() - 1 * 3600_000 + 500).toISOString(),
    },
    {
      id: 2,
      channelId: '2',
      channelName: '#alerts Discord',
      channelType: 'discord',
      alertType: 'healthcheck',
      severity: 'critical',
      serviceId: '2',
      serviceName: 'Auth Service',
      message: 'Auth Service transitioned to Degraded',
      status: 'sent',
      retryCount: 0,
      createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      sentAt: new Date(Date.now() - 3 * 3600_000 + 800).toISOString(),
    },
    {
      id: 3,
      channelId: '1',
      channelName: 'Ops Telegram',
      channelType: 'telegram',
      alertType: 'resource',
      severity: 'critical',
      hostId: 'worker-node-01',
      hostName: 'Worker-Node-01',
      message: 'Memory usage exceeded 90%',
      status: 'failed',
      errorMessage: 'Telegram API timeout',
      retryCount: 3,
      createdAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    },
    {
      id: 4,
      channelId: '3',
      channelName: '#incidents Slack',
      channelType: 'slack',
      alertType: 'endpoint',
      severity: 'warning',
      serviceId: '1',
      serviceName: 'API Gateway',
      message: 'Response time exceeded 2000ms threshold',
      status: 'sent',
      retryCount: 0,
      createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      sentAt: new Date(Date.now() - 2 * 3600_000 + 600).toISOString(),
    },
  ],
  total: 4,
  limit: 50,
  offset: 0,
};

const mockNotificationStats: NotificationStats = {
  totalSent: 178,
  totalFailed: 9,
  successRate: 95.2,
  byChannel: { 'Ops Telegram': 89, '#alerts Discord': 53, '#incidents Slack': 36 },
  byAlertType: { resource: 76, healthcheck: 54, endpoint: 36, log: 12 },
};

// ── Settings ──────────────────────────────────────────────────────────────────

const mockAppSettings: AppSettings = {
  alerts: { consecutiveFailures: 3 },
  retention: { metrics: '30d', logs: '90d' },
};

// ── Router ────────────────────────────────────────────────────────────────────

export function mockRouter<T>(endpoint: string, method = 'GET'): T {
  // Mutations in mock mode: return success silently
  if (method !== 'GET') return null as T;

  if (endpoint === '/dashboard/timeline') return mockTimeline as T;

  // /services/:id/metrics/summary
  if (/^\/services\/[^/]+\/metrics\/summary$/.test(endpoint)) return mockMetricsSummary as T;
  // /services/:id/metrics
  if (/^\/services\/[^/]+\/metrics/.test(endpoint)) return mockMetrics as T;
  // /services/:id/uptime
  if (/^\/services\/[^/]+\/uptime/.test(endpoint)) return mockUptimeData as T;
  // /services/:id/logs
  const serviceLogsMatch = endpoint.match(/^\/services\/([^/?]+)\/logs/);
  if (serviceLogsMatch) return filterLogs(endpoint, serviceLogsMatch[1]) as T;
  // /services/:id
  if (/^\/services\/[^/?]+$/.test(endpoint)) return mockApiServices[0] as T;
  // /services
  if (endpoint.startsWith('/services')) return [...mockApiServices, ...mockLogServices] as T;

  if (endpoint.startsWith('/logs')) return filterLogs(endpoint) as T;
  if (endpoint.startsWith('/incidents')) return mockIncidentList as T;

  if (endpoint.startsWith('/notifications')) return mockChannels as T;

  // /hosts/:id/system/info
  if (/^\/hosts\/[^/]+\/system\/info$/.test(endpoint)) return mockSystemInfo as T;
  // /hosts/:id/system/metrics
  if (/^\/hosts\/[^/]+\/system\/metrics/.test(endpoint)) return mockSystemMetrics as T;
  // /hosts/:id/system/processes
  if (/^\/hosts\/[^/]+\/system\/processes/.test(endpoint)) return mockProcesses as T;
  // /hosts/:id
  if (/^\/hosts\/[^/]+$/.test(endpoint)) return mockHosts[0] as T;
  // /hosts
  if (endpoint.startsWith('/hosts')) return mockHosts as T;

  if (endpoint.startsWith('/alert-rules')) return mockAlertRules as T;

  if (endpoint.startsWith('/notification-history/stats')) return mockNotificationStats as T;
  if (endpoint.startsWith('/notification-history')) return mockNotificationHistory as T;

  if (endpoint.startsWith('/settings')) return mockAppSettings as T;

  return null as T;
}
