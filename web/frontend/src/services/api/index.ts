import { servicesApi } from './services';
import { hostsApi } from './hosts';
import { alertsApi } from './alerts';
import { agentsApi } from './agents';
import { projectsApi } from './projects';

/**
 * 중앙 API 클라이언트 싱글톤.
 * 도메인별 구현은 각 파일을 참조:
 *   - services.ts   : traces, audit events
 *   - hosts.ts      : system info, metrics history
 *   - alerts.ts     : alert rules, notification channels, history, settings
 */
export const api = {
  ...servicesApi,
  ...hostsApi,
  ...alertsApi,
  ...agentsApi,
  ...projectsApi,
};

// Re-export all types — 기존 import 경로 유지
export type { ApiResponse } from './base';
export type {
  LogEntry,
  LogLevel,
  LinkedRequest,
  ApiRequest,
  TraceSpan,
  TraceSpanEvent,
  TraceDetail,
  AuditEvent,
  UptimeMonitor,
  UptimeMonitorInput,
  UptimeMonitorType,
  UptimeMonitorStatus,
  UptimeMonitorMetric,
  UptimeMonitorSummary,
  UptimeMonitorDay,
  UptimeMonitorHistory,
} from './services';
export type {
  SystemInfo,
  SystemMetricPoint,
  SystemMetricsHistory,
} from './hosts';
export type {
  ConnectedAgent,
  AgentServiceSnapshot,
  AgentServiceFlat,
  AgentEvent,
  ServiceHistoryPoint,
  ServiceUptimeDay,
  AgentIncident,
  AgentOverview,
  ApiRequestStatBucket,
  ApiRequestStatusSummary,
  LogHistogramBucket,
  OtelMetricName,
  OtelMetricPoint,
  OtelServiceMetric,
} from './agents';
export type {
  AlertRuleType,
  AlertMetric,
  AlertOperator,
  AlertSeverity,
  AlertRule,
  CreateAlertRuleData,
  UpdateAlertRuleData,
  NotificationChannel,
  TelegramConfig,
  DiscordConfig,
  SlackConfig,
  CreateNotificationChannelData,
  NotificationChannelHealth,
  NotificationStatus,
  NotificationAlertType,
  NotificationHistory,
  NotificationHistoryFilter,
  NotificationHistoryResponse,
  NotificationStats,
  AppSettings,
} from './alerts';
export type { Project, ProjectInput } from './projects';
