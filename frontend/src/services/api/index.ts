import { createRequestFn } from './base';
import { createDashboardApi } from './dashboard';
import { createServicesApi } from './services';
import { createHostsApi } from './hosts';
import { createAlertsApi } from './alerts';

const request = createRequestFn();

/**
 * 중앙 API 클라이언트 싱글톤.
 * 도메인별 구현은 각 파일을 참조:
 *   - dashboard.ts  : getDashboardTimeline
 *   - services.ts   : services CRUD, metrics, logs, incidents, health
 *   - hosts.ts      : hosts CRUD, system info, SSH
 *   - alerts.ts     : alert rules, notification channels, history, settings
 */
export const api = {
  ...createDashboardApi(request),
  ...createServicesApi(request),
  ...createHostsApi(request),
  ...createAlertsApi(request),
};

// Re-export all types — 기존 import 경로 유지
export type { ApiResponse, RequestFn } from './base';
export type { TimelineItem } from './dashboard';
export type {
  Service,
  CreateServiceData,
  Metric,
  MetricsSummary,
  MetricsParams,
  UptimeData,
  UptimeDay,
  UptimeParams,
  LogEntry,
  LogsParams,
  Incident,
  HealthStatus,
  ApiCaptureMode,
  ApiRequest,
  ApiCaptureConfig,
  ApiRequestListParams,
  ApiRequestListResponse,
} from './services';
export type {
  Host,
  CreateHostData,
  SSHTestResult,
  SystemInfo,
  SystemMetricPoint,
  SystemMetricsHistory,
  SystemProcess,
} from './hosts';
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
  NotificationStatus,
  NotificationAlertType,
  NotificationHistory,
  NotificationHistoryFilter,
  NotificationHistoryResponse,
  NotificationStats,
  AppSettings,
} from './alerts';
