import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';
import {
  mockMetrics,
  mockResponseTimeChartData,
  mockErrorLogs,
  mockUptimeStats,
} from '../mocks/healthcheck';

// --- Service Detail Hooks ---

export function useServiceMetrics(serviceId: string) {
  return useDataFetch(
    mockMetrics,
    async () => {
      const summary = await api.getServiceMetricsSummary(serviceId);
      const errorRate = 100 - summary.uptime;
      return [
        {
          label: 'Avg Latency',
          value: `${summary.avgResponseTime.toFixed(0)}ms`,
          change: '-4.2%',
          changeType: 'down' as const,
          subtext: 'Compared to previous 24h',
          icon: 'timer',
          iconColor: 'text-slate-400 dark:text-text-muted-dark',
        },
        {
          label: 'Error Rate',
          value: `${errorRate.toFixed(2)}%`,
          change: summary.uptime >= 99 ? '-0.01%' : '+0.01%',
          changeType: (summary.uptime >= 99 ? 'down' : 'up') as 'up' | 'down',
          subtext: `${summary.uptime.toFixed(2)}% success rate`,
          icon: 'error_outline',
          iconColor: 'text-[#fa6238]',
        },
        {
          label: 'Request Volume',
          value: `${(summary.totalChecks / 1000).toFixed(1)}k`,
          change: '+12%',
          changeType: 'up' as const,
          subtext: 'Peak: 3.2k req/min',
          icon: 'speed',
          iconColor: 'text-primary',
        },
      ];
    },
    [serviceId]
  );
}

export function useServiceCharts(serviceId: string) {
  return useDataFetch(
    mockResponseTimeChartData,
    async () => {
      const metrics = await api.getServiceMetrics(serviceId, { limit: '24' });
      return metrics.map((m) => m.responseTime);
    },
    [serviceId]
  );
}

export function useServiceErrorLogs(serviceId: string) {
  return useDataFetch(
    mockErrorLogs,
    async () => {
      const logs = await api.getServiceLogs(serviceId, { level: 'error' });
      const levelMap: Record<string, 'CRITICAL' | 'WARNING' | 'INFO'> = {
        error: 'CRITICAL',
        warn: 'WARNING',
        info: 'INFO',
      };
      return logs.map((log) => ({
        id: log.id,
        level: levelMap[log.level] || 'INFO',
        message: log.message,
        timestamp: log.createdAt,
      }));
    },
    [serviceId]
  );
}

export function useServiceUptime(serviceId: string) {
  return useDataFetch(
    mockUptimeStats,
    async () => {
      const uptime = await api.getServiceUptime(serviceId, { days: '30' });
      return {
        uptime: `${Math.floor((uptime.percentage * 24 * 30) / 100)}h`,
        totalIncidents: uptime.days.filter((d) => d.status !== 'up').length,
        mttr: '0m',
        percentage: `${uptime.percentage.toFixed(2)}%`,
      };
    },
    [serviceId]
  );
}

// --- Services List Hooks ---

export function useServices() {
  return useDataFetch([], async () => api.getServices());
}

export function useService(serviceId: string) {
  return useDataFetch(null, async () => api.getServiceById(serviceId), [serviceId]);
}

export function useIncidents() {
  return useDataFetch([], async () => api.getIncidents());
}
