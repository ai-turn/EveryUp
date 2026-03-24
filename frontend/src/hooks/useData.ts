/**
 * @deprecated 이 파일은 하위 호환용 re-export 배럴입니다.
 * 새 코드에서는 도메인별 훅 파일을 직접 import 하세요:
 *   - useDashboard.ts   : useDashboardServices, useDashboardIncidents
 *   - useHealthcheck.ts : useServiceMetrics, useServiceCharts, useServiceErrorLogs,
 *                         useServiceUptime, useServices, useService, useIncidents
 *   - useInfra.ts       : useMonitoringGauges, useMonitoringTrends, useMonitoringProcesses,
 *                         useMonitoringResources, useHost
 *   - useLogs.ts        : useLogs
 *   - useAlerts.ts      : useNotificationChannels, useNotificationRules
 *   - useSettings.ts    : useSettingsProtocols, useSettingsConfigGroups
 *   - useDataFetch.ts   : useDataFetch (제네릭 기반 훅)
 */

export { useDashboardServices, useDashboardIncidents } from './useDashboard';
export {
  useServiceMetrics,
  useServiceCharts,
  useServiceErrorLogs,
  useServiceUptime,
  useServices,
  useService,
  useIncidents,
} from './useHealthcheck';
export {
  useMonitoringGauges,
  useMonitoringTrends,
  useMonitoringProcesses,
  useMonitoringResources,
  useHost,
} from './useInfra';
export { useLogs } from './useLogs';
export { useNotificationChannels, useNotificationRules } from './useAlerts';
export { useSettingsProtocols, useSettingsConfigGroups } from './useSettings';
export { useDataFetch } from './useDataFetch';
export type { FetchState } from './useDataFetch';
