/**
 * Mock router for demo mode.
 * Maps API endpoint patterns to mock data so ALL api.* calls (including direct
 * calls that bypass useDataFetch) return plausible data in demo/mock mode.
 */

import { mockServices } from '../mocks/dashboard/services.mock';
import { mockIncidents as mockDashboardIncidents } from '../mocks/dashboard/incidents.mock';
import { mockLogEntries as allMockLogs, mockTraceIds } from '../mocks/logs/logs.mock';
import { mockResponseTimeChartData } from '../mocks/healthcheck/charts.mock';
import { mockGauges } from '../mocks/infra';
import { mockResources } from '../mocks/infra/resourceList.mock';
import { mockChannels } from '../mocks/alerts/channels.mock';

import type {
  TimelineItem,
  Service,
  MetricsSummary,
  Metric,
  UptimeData,
  LogEntry,
  Incident,
  Host,
  SystemInfo,
  SystemMetricsHistory,
  SystemProcess,
  AlertRule,
  NotificationHistoryResponse,
  NotificationStats,
  AppSettings,
  ApiRequest,
  TraceDetail,
  ConnectedAgent,
  AgentServiceFlat,
  AgentEvent,
  ServiceHistoryPoint,
  ServiceUptimeDay,
  AgentIncident,
} from './api';

// ?? Dashboard ????????????????????????????????????????????????????????????????

const mockTimeline: TimelineItem[] = mockDashboardIncidents.map((i) => ({
  id: i.id,
  type: i.type,
  message: i.message,
  time: i.time,
  service: i.serviceName,
}));

// ?? Services ?????????????????????????????????????????????????????????????????

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
    logLevelFilter: ['error', 'warn', 'info', 'debug'],
  },
];

// ?? Metrics ???????????????????????????????????????????????????????????????????

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

// ?? Logs ??????????????????????????????????????????????????????????????????????

function filterLogs(endpoint: string, serviceId?: string): LogEntry[] {
  const [, qs] = endpoint.split('?');
  const params = new URLSearchParams(qs ?? '');
  const level = params.get('level') ?? '';
  const limit = parseInt(params.get('limit') ?? '200', 10);

  let logs = allMockLogs;
  if (serviceId) logs = logs.filter(l => l.serviceId === serviceId);
  if (level && level !== 'all') logs = logs.filter(l => l.level === level);
  return logs.slice(0, limit);
}

// ?? Incidents ?????????????????????????????????????????????????????????????????

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

// ?? Notifications ?????????????????????????????????????????????????????????????

// ?? Hosts ?????????????????????????????????????????????????????????????????????

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

const mockHostSummaries = mockResources.map((r, index) => {
  const isProblem = ['warning', 'critical', 'error'].includes(r.status);
  const isRemote = index !== 1;
  const lastSeenAt = new Date(Date.now() - (index + 1) * 90_000).toISOString();
  return {
    ...r,
    connectionType: isRemote ? 'remote' : 'local',
    isActive: r.status !== 'critical',
    isRemote,
    severity: r.status === 'critical' || r.status === 'error' ? 'critical' : r.status === 'warning' ? 'warning' : 'none',
    statusReason: isProblem ? 'threshold_exceeded' : 'healthy',
    lastSeenAt,
    lastCollectedAt: lastSeenAt,
    incidentSince: isProblem ? new Date(Date.now() - (index + 2) * 3600_000).toISOString() : undefined,
    lastError: r.status === 'critical' ? 'Memory usage exceeded 90%' : undefined,
    cpuUsage: r.status === 'critical' ? 91 : 42 + index * 7,
    memoryUsage: r.status === 'warning' ? 83 : 51 + index * 6,
    diskUsage: 38 + index * 5,
    createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  };
});

// ?? System Resource Monitoring ????????????????????????????????????????????????

const mockSystemInfo: SystemInfo = {
  hostname: 'prod-server-01',
  os: 'Ubuntu 22.04 LTS',
  platform: 'linux',
  kernel: '5.15.0-92-generic',
  uptime: 1_234_567,
  ip: '192.168.1.50',
  cpu: { cores: 8, usage: mockGauges[0]?.percentage ?? 42 },
  memory: { total: 16, used: 9.6, usage: mockGauges[1]?.percentage ?? 60 },
  disk: { total: 500, used: 210, usage: mockGauges[2]?.percentage ?? 42, readSpeed: 120, writeSpeed: 80 },
  network: { in: 3.2, out: 1.4 },
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
    netIn: 8 + Math.random() * 20,
    netOut: 4 + Math.random() * 16,
  })),
};

const mockProcesses: SystemProcess[] = [
  { pid: 1234, name: 'node', cpu: 12.4, memory: '512 MB', memoryBytes: 536_870_912, status: 'running' },
  { pid: 5678, name: 'postgres', cpu: 8.1, memory: '1.2 GB', memoryBytes: 1_288_490_189, status: 'running' },
  { pid: 9012, name: 'redis-server', cpu: 2.3, memory: '256 MB', memoryBytes: 268_435_456, status: 'running' },
  { pid: 3456, name: 'nginx', cpu: 1.1, memory: '64 MB', memoryBytes: 67_108_864, status: 'running' },
  { pid: 7890, name: 'prometheus', cpu: 3.7, memory: '384 MB', memoryBytes: 402_653_184, status: 'running' },
];

// ?? Alert Rules ???????????????????????????????????????????????????????????????

const mockAlertRules: AlertRule[] = [
  {
    id: '1',
    name: 'High CPU Usage',
    type: 'resource',
    agentId: 'agent_prod-db-01',
    metric: 'cpu',
    operator: 'gt',
    threshold: 85,
    duration: 5,
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
    agentId: 'agent_123',
    serviceKey: 'api',
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
    agentId: 'agent_worker-node-01',
    metric: 'memory',
    operator: 'gt',
    threshold: 90,
    duration: 3,
    severity: 'critical',
    isEnabled: true,
    isSystem: false,
    cooldown: 600,
    channelIds: ['2'],
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];

// ?? Notification History ??????????????????????????????????????????????????????

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

// ?? API Requests ??????????????????????????????????????????????????????????????

const now2 = Date.now();
const s = (secondsAgo: number) => new Date(now2 - secondsAgo * 1000).toISOString();

const mockApiRequests: ApiRequest[] = [
  { id: 1, serviceId: '1', requestId: '01HV8QZXKAB1', method: 'POST',   path: '/api/v1/auth/login',        pathTemplate: '/api/v1/auth/login',        statusCode: 200, durationMs: 42,   clientIp: '10.0.0.5',  isError: false, traceId: mockTraceIds.apiGatewayAuth, spanId: '00f067aa0ba902b7', createdAt: s(30) },
  { id: 2, serviceId: '1', requestId: '01HV8QZXKAC2', method: 'GET',    path: '/api/v1/users/42',          pathTemplate: '/api/v1/users/:id',         statusCode: 200, durationMs: 18,   clientIp: '10.0.0.12', isError: false, createdAt: s(90) },
  { id: 3, serviceId: '1', requestId: '01HV8QZXKAD3', method: 'PUT',    path: '/api/v1/users/7/profile',   pathTemplate: '/api/v1/users/:id/profile', statusCode: 422, durationMs: 35,   clientIp: '10.0.0.7',  isError: false, createdAt: s(200) },
  { id: 4, serviceId: '1', requestId: '01HV8QZXKAE4', method: 'DELETE', path: '/api/v1/orders/1a2b3c4d',  pathTemplate: '/api/v1/orders/:id',        statusCode: 500, durationMs: 312,  clientIp: '10.0.0.3',  isError: true,  error: 'deadlock detected', createdAt: s(400) },
  { id: 5, serviceId: '1', requestId: '01HV8QZXKAF5', method: 'GET',    path: '/api/v1/products',         pathTemplate: '/api/v1/products',          statusCode: 200, durationMs: 67,   clientIp: '10.0.0.9',  isError: false, createdAt: s(600) },
  { id: 6, serviceId: '5', requestId: '01HV8QZXKAG6', method: 'POST',   path: '/api/v1/payments',         pathTemplate: '/api/v1/payments',          statusCode: 503, durationMs: 5001, clientIp: '10.0.0.15', isError: true,  error: 'payment gateway timeout', traceId: mockTraceIds.paymentWebhook, spanId: '7ad6b7169203331b', createdAt: s(900) },
];

const ns = (secondsAgo: number, offsetMs = 0) => (now2 - secondsAgo * 1000 + offsetMs) * 1_000_000;

const mockTraceDetails: Record<string, TraceDetail> = {
  [mockTraceIds.apiGatewayAuth]: {
    traceId: mockTraceIds.apiGatewayAuth,
    spans: [
      {
        id: 1,
        serviceId: '1',
        serviceName: 'API Gateway',
        traceId: mockTraceIds.apiGatewayAuth,
        spanId: '00f067aa0ba902b7',
        name: 'POST /api/v1/auth/login',
        kind: 'SERVER',
        startUnixNano: ns(30),
        endUnixNano: ns(30, 42),
        durationMs: 42,
        statusCode: 'OK',
        attributes: {
          'http.request.method': 'POST',
          'url.path': '/api/v1/auth/login',
          'http.response.status_code': 200,
          'http.request.header.content-type': ['application/json'],
          'http.request.header.user-agent': ['Mozilla/5.0 (demo)'],
          'http.request.header.authorization': '***',
          'http.response.header.content-type': ['application/json; charset=utf-8'],
          'http.response.header.set-cookie': '***',
        },
        events: [
          {
            name: 'request_body_masked',
            timeUnixNano: ns(30),
            attributes: { body: '{"username":"alice@example.com","password":"***"}', body_size: 49, body_truncated: false, mask_applied: true },
          },
          {
            name: 'response_body_masked',
            timeUnixNano: ns(30, 42),
            attributes: { body: '{"token":"***","expiresIn":3600,"role":"admin"}', body_size: 47, body_truncated: false, mask_applied: true },
          },
        ],
        resource: { 'service.name': 'api-gateway', 'deployment.environment': 'demo' },
        createdAt: s(30),
      },
      {
        id: 2,
        serviceId: '2',
        serviceName: 'Auth Service',
        traceId: mockTraceIds.apiGatewayAuth,
        spanId: 'b7ad6b7169203331',
        parentSpanId: '00f067aa0ba902b7',
        name: 'POST auth.internal:8080/session',
        kind: 'CLIENT',
        startUnixNano: ns(30, 8),
        endUnixNano: ns(30, 40),
        durationMs: 32,
        statusCode: 'ERROR',
        statusMessage: 'upstream timeout',
        attributes: {
          'server.address': 'auth.internal',
          'server.port': 8080,
          'error.type': 'timeout',
        },
        resource: { 'service.name': 'api-gateway', 'service.version': '1.8.0' },
        createdAt: s(30),
      },
    ],
    logs: allMockLogs.filter((log) => log.traceId === mockTraceIds.apiGatewayAuth),
    apiRequests: mockApiRequests.filter((request) => request.traceId === mockTraceIds.apiGatewayAuth),
  },
  [mockTraceIds.paymentWebhook]: {
    traceId: mockTraceIds.paymentWebhook,
    spans: [
      {
        id: 3,
        serviceId: '5',
        serviceName: 'Payment Worker',
        traceId: mockTraceIds.paymentWebhook,
        spanId: '7ad6b7169203331b',
        name: 'POST /api/v1/payments',
        kind: 'SERVER',
        startUnixNano: ns(900),
        endUnixNano: ns(900, 5001),
        durationMs: 5001,
        statusCode: 'ERROR',
        statusMessage: 'payment gateway timeout',
        attributes: {
          'http.request.method': 'POST',
          'url.path': '/api/v1/payments',
          'http.response.status_code': 503,
        },
        events: [
          {
            name: 'request_body_masked',
            timeUnixNano: ns(900),
            attributes: { body: '{"orderId":"ord_1a2b3c","amount":48000,"currency":"KRW","card":"***"}', body_size: 69, body_truncated: false, mask_applied: true },
          },
          {
            name: 'response_body_masked',
            timeUnixNano: ns(900, 5001),
            attributes: { body: '{"error":"upstream_timeout","gateway":"payments.partner.io"}', body_size: 60, body_truncated: false, mask_applied: true },
          },
        ],
        resource: { 'service.name': 'payment-worker', 'deployment.environment': 'demo' },
        createdAt: s(900),
      },
      {
        id: 4,
        serviceId: '5',
        serviceName: 'Payment Worker',
        traceId: mockTraceIds.paymentWebhook,
        spanId: 'c4da95f66b729f70',
        parentSpanId: '7ad6b7169203331b',
        name: 'POST payments.partner.io/charge',
        kind: 'CLIENT',
        startUnixNano: ns(900, 15),
        endUnixNano: ns(900, 4990),
        durationMs: 4975,
        statusCode: 'ERROR',
        statusMessage: 'certificate validation failed',
        attributes: {
          'server.address': 'payments.partner.io',
          'error.type': 'tls_certificate',
        },
        resource: { 'service.name': 'payment-worker', 'service.version': '2.4.1' },
        createdAt: s(900),
      },
    ],
    logs: allMockLogs.filter((log) => log.traceId === mockTraceIds.paymentWebhook),
    apiRequests: mockApiRequests.filter((request) => request.traceId === mockTraceIds.paymentWebhook),
  },
};


// ?? Settings ??????????????????????????????????????????????????????????????????

// ?? Agents ???????????????????????????????????????????????????????????????????

const mockAgents: ConnectedAgent[] = [
  {
    id: 'agent_demo_01', name: 'prod-server', mode: 'connected', version: '0.3.0',
    lastSeenAt: new Date(Date.now() - 15_000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 15_000).toISOString(),
  },
  {
    // Created but never connected — renders as a pending card in the main grid.
    id: 'agent_demo_02', name: 'staging-api', mode: 'standalone',
    lastSeenAt: new Date(Date.now() - 90_000).toISOString(),
    createdAt: new Date(Date.now() - 90_000).toISOString(),
    updatedAt: new Date(Date.now() - 90_000).toISOString(),
  },
];

const mockAgentServicesFlat: AgentServiceFlat[] = [
  {
    agentId: 'agent_demo_01', agentName: 'prod-server',
    key: 'shop:api', name: 'api', checkType: 'http', runtime: 'node',
    endpoint: 'http://api:8080/health', healthy: true, seen: true, silenced: false,
    lastStatus: 200, lastLatency: '42ms',
    updatedAt: new Date(Date.now() - 30_000).toISOString(),
    observedAt: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    agentId: 'agent_demo_01', agentName: 'prod-server',
    key: 'postgres', name: 'postgres', checkType: 'tcp',
    endpoint: 'postgres:5432', healthy: true, seen: true, silenced: false,
    lastStatus: 0, lastLatency: '5ms',
    updatedAt: new Date(Date.now() - 30_000).toISOString(),
    observedAt: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    agentId: 'agent_demo_01', agentName: 'prod-server',
    key: 'shop:payment-worker', name: 'payment-worker', checkType: 'http', runtime: 'java',
    endpoint: 'http://payment-worker:8090/health', healthy: false, seen: true, silenced: false,
    lastStatus: 503, lastLatency: '5001ms', lastError: 'payment gateway timeout',
    updatedAt: new Date(Date.now() - 90_000).toISOString(),
    observedAt: new Date(Date.now() - 90_000).toISOString(),
  },
];

const nowAgent = Date.now();

const mockAgentHistory: ServiceHistoryPoint[] = Array.from({ length: 24 }, (_, i) => ({
  time: new Date(nowAgent - (23 - i) * 3_600_000).toISOString(),
  latencyMs: 30 + Math.sin(i / 4) * 15 + Math.random() * 10,
  uptimePct: i === 10 || i === 17 ? 0 : 100,
  total: 12,
}));

const mockAgentUptime: ServiceUptimeDay[] = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(nowAgent - (89 - i) * 86_400_000).toISOString().slice(0, 10),
  uptimePct: i === 42 || i === 77 ? 94 : 100,
  healthyChecks: i === 42 || i === 77 ? 282 : 300,
  totalChecks: 300,
}));

const mockAgentIncidents: AgentIncident[] = [
  {
    key: 'shop:payment-worker', serviceName: 'payment-worker',
    startedAt: new Date(nowAgent - 12 * 60_000).toISOString(),
    durationSec: 12 * 60, active: true,
  },
  {
    key: 'api', serviceName: 'api',
    startedAt: new Date(nowAgent - 3 * 86_400_000).toISOString(),
    endedAt: new Date(nowAgent - 3 * 86_400_000 + 24 * 60_000).toISOString(),
    durationSec: 24 * 60, active: false,
  },
  {
    key: 'postgres', serviceName: 'postgres',
    startedAt: new Date(nowAgent - 8 * 86_400_000).toISOString(),
    endedAt: new Date(nowAgent - 8 * 86_400_000 + 8 * 60_000).toISOString(),
    durationSec: 8 * 60, active: false,
  },
];

const mockAgentEvents: AgentEvent[] = [
  {
    id: 1, agentId: 'agent_demo_01', time: new Date(nowAgent - 2 * 3_600_000).toISOString(),
    type: 'status_change', targetKey: 'payment-worker', serviceName: 'payment-worker',
    message: 'payment-worker became unhealthy: 503 Service Unavailable',
    createdAt: new Date(nowAgent - 2 * 3_600_000).toISOString(),
  },
  {
    id: 2, agentId: 'agent_demo_01', time: new Date(nowAgent - 5 * 3_600_000).toISOString(),
    type: 'status_change', targetKey: 'api', serviceName: 'api',
    message: 'api recovered: 200 OK (42ms)',
    createdAt: new Date(nowAgent - 5 * 3_600_000).toISOString(),
  },
];

const mockAgentServiceLogs: LogEntry[] = [
  { id: 101, serviceId: '', serviceName: 'api', level: 'error', message: 'Connection timeout to upstream: auth.internal:8080 after 5000ms', source: 'otlp', traceId: mockTraceIds.apiGatewayAuth, createdAt: new Date(nowAgent - 60_000).toISOString() },
  { id: 102, serviceId: '', serviceName: 'api', level: 'warn',  message: 'Rate limit exceeded for client IP 203.0.113.42 — throttling to 10 req/s', source: 'otlp', createdAt: new Date(nowAgent - 180_000).toISOString() },
  { id: 103, serviceId: '', serviceName: 'api', level: 'info',  message: 'Server listening on :8080', source: 'otlp', createdAt: new Date(nowAgent - 600_000).toISOString() },
  { id: 104, serviceId: '', serviceName: 'api', level: 'error', message: 'Payment gateway timeout after 5000ms', source: 'otlp', traceId: mockTraceIds.paymentWebhook, createdAt: new Date(nowAgent - 720_000).toISOString() },
];

const mockAgentServiceRequests: ApiRequest[] = [
  { id: 201, serviceId: '', serviceName: 'api', requestId: 'r01', method: 'POST',   path: '/api/v1/auth/login',      pathTemplate: '/api/v1/auth/login',  statusCode: 200, durationMs: 42,  isError: false, traceId: mockTraceIds.apiGatewayAuth, createdAt: new Date(nowAgent - 30_000).toISOString() },
  { id: 202, serviceId: '', serviceName: 'api', requestId: 'r02', method: 'GET',    path: '/api/v1/users/42',        pathTemplate: '/api/v1/users/:id',   statusCode: 200, durationMs: 18,  isError: false, createdAt: new Date(nowAgent - 90_000).toISOString() },
  { id: 203, serviceId: '', serviceName: 'api', requestId: 'r03', method: 'POST',   path: '/api/v1/payments',        pathTemplate: '/api/v1/payments',    statusCode: 503, durationMs: 5001, isError: true,  error: 'payment gateway timeout', traceId: mockTraceIds.paymentWebhook, createdAt: new Date(nowAgent - 400_000).toISOString() },
  { id: 204, serviceId: '', serviceName: 'api', requestId: 'r04', method: 'GET',    path: '/api/v1/products',        pathTemplate: '/api/v1/products',    statusCode: 200, durationMs: 67,  isError: false, createdAt: new Date(nowAgent - 600_000).toISOString() },
];

// 5-minute buckets over the last 6h: rising volume with a latency spike +
// error burst in the middle so the trends chart shows movement.
function mockRequestStats() {
  const buckets = [];
  for (let i = 72; i >= 0; i -= 1) {
    const time = new Date(nowAgent - i * 5 * 60_000).toISOString();
    const spike = i > 30 && i < 40; // a rough patch mid-window
    const count = Math.round(20 + 30 * Math.sin(i / 8) + Math.random() * 10 + (spike ? 25 : 0));
    const errorCount = spike ? Math.round(count * 0.18) : Math.round(count * 0.01 + Math.random());
    const p50 = Math.round(35 + 10 * Math.sin(i / 5) + (spike ? 120 : 0));
    const p95 = Math.round(p50 * 2.3 + (spike ? 300 : 40));
    buckets.push({ time, count, errorCount, p50, p95, timed: count });
  }
  return buckets;
}

const mockOtelMetricNames = [
  { metricName: 'http.server.request.duration', metricType: 'histogram', unit: 's',  lastAt: new Date(nowAgent - 30_000).toISOString() },
  { metricName: 'jvm.memory.used',              metricType: 'gauge',     unit: 'By', lastAt: new Date(nowAgent - 30_000).toISOString() },
  { metricName: 'http.server.active_requests',  metricType: 'sum',       unit: '1',  lastAt: new Date(nowAgent - 30_000).toISOString() },
];

// One point per minute over the last hour, two attribute series for the
// histogram metric so the multi-series pivot renders in mock mode.
function mockOtelMetricPoints(endpoint: string) {
  const name = new URLSearchParams(endpoint.split('?')[1] ?? '').get('name') ?? 'jvm.memory.used';
  const points = [];
  let id = 1;
  for (let i = 60; i >= 0; i -= 1) {
    const createdAt = new Date(nowAgent - i * 60_000).toISOString();
    if (name === 'http.server.request.duration') {
      points.push(
        { id: id++, metricName: name, metricType: 'histogram', unit: 's', attributes: { 'http.route': '/orders' },   value: 0.05 + 0.02 * Math.sin(i / 5) + Math.random() * 0.01, count: 12, total: 0.7, createdAt },
        { id: id++, metricName: name, metricType: 'histogram', unit: 's', attributes: { 'http.route': '/users/:id' }, value: 0.02 + 0.01 * Math.cos(i / 7) + Math.random() * 0.005, count: 30, total: 0.66, createdAt },
      );
    } else if (name === 'jvm.memory.used') {
      points.push({ id: id++, metricName: name, metricType: 'gauge', unit: 'By', attributes: {}, value: 256 * 1048576 + 64 * 1048576 * Math.sin(i / 10) + Math.random() * 10 * 1048576, createdAt });
    } else {
      points.push({ id: id++, metricName: name, metricType: 'sum', unit: '1', attributes: {}, value: Math.max(0, Math.round(4 + 3 * Math.sin(i / 4) + Math.random() * 2)), createdAt });
    }
  }
  return points;
}

const mockAppSettings: AppSettings = {
  alerts: { consecutiveFailures: 3 },
  retention: { metrics: '30d', logs: '90d' },
};

// ?? Router ????????????????????????????????????????????????????????????????????

function randomHex(bytes: number): string {
  let s = '';
  for (let i = 0; i < bytes; i++) s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return s;
}

export function mockRouter<T>(endpoint: string, method = 'GET', body?: BodyInit | null): T {
  // Mutations in mock mode: mutate the in-memory fixtures so flows feel real.
  if (method !== 'GET') {
    // POST /agents — create a pending agent (no services yet → pending card)
    if (method === 'POST' && endpoint === '/agents') {
      let name = 'new-service';
      try {
        const parsed = JSON.parse(typeof body === 'string' ? body : '{}');
        if (parsed?.name) name = String(parsed.name);
      } catch { /* keep default */ }
      const id = `agent_mock_${Date.now()}`;
      const now = new Date().toISOString();
      mockAgents.push({ id, name, mode: 'standalone', lastSeenAt: now, createdAt: now, updatedAt: now });
      return { id, name, apiKey: `evup_svc_${randomHex(24)}` } as T;
    }
    // POST /agents/:id/rotate-key — issue a fresh key
    if (method === 'POST' && /^\/agents\/[^/]+\/rotate-key$/.test(endpoint)) {
      return { apiKey: `evup_svc_${randomHex(24)}` } as T;
    }
    // DELETE /agents/:id — remove the agent so its card disappears
    const delMatch = endpoint.match(/^\/agents\/([^/]+)$/);
    if (method === 'DELETE' && delMatch) {
      const idx = mockAgents.findIndex(a => a.id === delMatch[1]);
      if (idx !== -1) mockAgents.splice(idx, 1);
      return null as T;
    }
    // DELETE /agents/:id/services/:key — remove one service card
    const svcDelMatch = endpoint.match(/^\/agents\/([^/]+)\/services\/([^/]+)$/);
    if (method === 'DELETE' && svcDelMatch) {
      const key = decodeURIComponent(svcDelMatch[2]);
      const idx = mockAgentServicesFlat.findIndex(s => s.agentId === svcDelMatch[1] && s.key === key);
      if (idx !== -1) mockAgentServicesFlat.splice(idx, 1);
      return null as T;
    }
    // PUT /agents/:id/services/:key/log-filter — echo the saved levels
    if (method === 'PUT' && /^\/agents\/[^/]+\/services\/[^/]+\/log-filter$/.test(endpoint)) {
      let levels: string[] = [];
      try {
        const parsed = JSON.parse(typeof body === 'string' ? body : '{}');
        if (Array.isArray(parsed?.levels)) levels = parsed.levels.map(String);
      } catch { /* keep empty */ }
      return { levels } as T;
    }
    return null as T;
  }

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
  // /services/:id/api-requests/:reqId
  const apiReqDetailMatch = endpoint.match(/^\/services\/([^/]+)\/api-requests\/(\d+)/);
  if (apiReqDetailMatch) {
    const found = mockApiRequests.find(r => String(r.id) === apiReqDetailMatch[2]);
    return (found ?? null) as T;
  }
  // /services/:id/api-requests
  const apiReqListMatch = endpoint.match(/^\/services\/([^/]+)\/api-requests/);
  if (apiReqListMatch) {
    const [, qs] = endpoint.split('?');
    const p = new URLSearchParams(qs ?? '');
    let filtered = mockApiRequests.filter(r => r.serviceId === apiReqListMatch[1]);
    const method = p.get('method');
    if (method) filtered = filtered.filter(r => r.method === method.toUpperCase());
    const minStatus = parseInt(p.get('minStatus') ?? '0');
    const maxStatus = parseInt(p.get('maxStatus') ?? '0');
    if (minStatus) filtered = filtered.filter(r => r.statusCode >= minStatus);
    if (maxStatus) filtered = filtered.filter(r => r.statusCode <= maxStatus);
    if (p.get('errorsOnly') === 'true') filtered = filtered.filter(r => r.isError);
    const search = p.get('search') ?? '';
    if (search) filtered = filtered.filter(r => r.path.includes(search) || (r.requestId ?? '').includes(search));
    return { items: [...filtered], total: filtered.length } as unknown as T;
  }
  // /traces/:traceId
  const traceMatch = endpoint.match(/^\/traces\/([^/?]+)/);
  if (traceMatch) {
    const traceId = decodeURIComponent(traceMatch[1]);
    return (mockTraceDetails[traceId] ?? {
      traceId,
      spans: [],
      logs: [],
      apiRequests: [],
    }) as T;
  }
  // /services/:id
  if (/^\/services\/[^/?]+$/.test(endpoint)) return mockApiServices[0] as T;
  // /services
  if (endpoint.startsWith('/services')) return [...mockApiServices, ...mockLogServices] as T;

  if (endpoint.startsWith('/logs')) return filterLogs(endpoint) as T;
  if (endpoint.startsWith('/incidents')) return mockIncidentList as T;

  // /agents/services/all — must come before /agents/:id/services
  if (endpoint === '/agents/services/all') return mockAgentServicesFlat as T;
  // /agents/:agentId/key
  if (/^\/agents\/[^/]+\/key$/.test(endpoint))
    return { apiKey: 'evup_svc_3f9c4a1b8e3d6f0a5c7b9d2e4f6a8c0b1d3e5f7a9c2b4d6e', available: true } as T;
  // /agents/:agentId/services/:key/log-filter
  if (/^\/agents\/[^/]+\/services\/[^/]+\/log-filter$/.test(endpoint))
    return { levels: ['error', 'warn', 'info'] } as T;
  // /agents/:agentId/services/:key/logs
  if (/^\/agents\/[^/]+\/services\/[^/]+\/logs/.test(endpoint))
    return { data: mockAgentServiceLogs, total: mockAgentServiceLogs.length } as unknown as T;
  // /agents/:agentId/services/:key/request-stats
  if (/^\/agents\/[^/]+\/services\/[^/]+\/request-stats/.test(endpoint))
    return mockRequestStats() as T;
  // /agents/:agentId/request-stats — project-level rollup (all services)
  if (/^\/agents\/[^/]+\/request-stats/.test(endpoint))
    return mockRequestStats() as T;
  // /agents/:agentId/services/:key/requests — payment-worker has no HTTP
  // traffic, so its API tab exercises the empty state + setup guidance.
  if (/^\/agents\/[^/]+\/services\/shop%3Apayment-worker\/requests/.test(endpoint))
    return { data: [], total: 0 } as unknown as T;
  if (/^\/agents\/[^/]+\/services\/[^/]+\/requests/.test(endpoint))
    return { data: mockAgentServiceRequests, total: mockAgentServiceRequests.length } as unknown as T;
  // /agents/:agentId/services/:key/otel-metrics/points?name=...
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics\/points/.test(endpoint))
    return mockOtelMetricPoints(endpoint) as T;
  // /agents/:agentId/services/:key/otel-metrics
  if (/^\/agents\/[^/]+\/services\/[^/]+\/otel-metrics/.test(endpoint))
    return mockOtelMetricNames as T;
  // /agents/:agentId/services/:key/history
  if (/^\/agents\/[^/]+\/services\/[^/]+\/history/.test(endpoint)) return mockAgentHistory as T;
  // /agents/:agentId/services/:key/uptime
  if (/^\/agents\/[^/]+\/services\/[^/]+\/uptime/.test(endpoint)) return mockAgentUptime as T;
  // /agents/:agentId/services/:key/events
  if (/^\/agents\/[^/]+\/services\/[^/]+\/events/.test(endpoint)) return mockAgentEvents as T;
  // /agents/:agentId/services
  if (/^\/agents\/[^/]+\/services/.test(endpoint)) return mockAgentServicesFlat as T;
  // /agents/:agentId/events
  if (/^\/agents\/[^/]+\/events/.test(endpoint)) return mockAgentEvents as T;
  // /agents/:agentId/uptime — project-level rollup
  if (/^\/agents\/[^/]+\/uptime/.test(endpoint)) return mockAgentUptime as T;
  // /agents/:agentId/incidents
  if (/^\/agents\/[^/]+\/incidents/.test(endpoint)) return mockAgentIncidents as T;
  // /agents
  if (endpoint.startsWith('/agents')) return mockAgents as T;

  if (endpoint.startsWith('/notifications')) return mockChannels as T;

  // /hosts/:id/system/info
  if (/^\/hosts\/[^/]+\/system\/info$/.test(endpoint)) return mockSystemInfo as T;
  // /hosts/:id/system/metrics
  if (/^\/hosts\/[^/]+\/system\/metrics/.test(endpoint)) return mockSystemMetrics as T;
  // /hosts/:id/system/processes
  if (/^\/hosts\/[^/]+\/system\/processes/.test(endpoint)) return mockProcesses as T;
  // /hosts/summary
  if (endpoint === '/hosts/summary') return mockHostSummaries as T;
  // /hosts/:id
  if (/^\/hosts\/[^/]+$/.test(endpoint)) return mockHosts[0] as T;
  // /hosts
  if (endpoint.startsWith('/hosts')) return mockHosts as T;

  const alertRuleMatch = endpoint.match(/^\/alert-rules\/([^/?]+)$/);
  if (alertRuleMatch) {
    const id = decodeURIComponent(alertRuleMatch[1]);
    return (mockAlertRules.find(rule => rule.id === id) ?? null) as T;
  }
  if (endpoint === '/alert-rules') return mockAlertRules as T;

  if (endpoint.startsWith('/notification-history/stats')) return mockNotificationStats as T;
  if (endpoint.startsWith('/notification-history')) return mockNotificationHistory as T;

  if (endpoint.startsWith('/settings')) return mockAppSettings as T;

  return null as T;
}
