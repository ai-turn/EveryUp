import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';
import { mockGauges, mockCharts as mockTrendCharts, mockProcesses, mockHost } from '../mocks/infra';
import { mockResources } from '../mocks/infra/resourceList.mock';
import {
  hostsToResources,
  systemInfoToGauges,
  historyToCharts,
  systemProcessesToProcesses,
} from '../utils/systemTransform';

export function useMonitoringGauges(hostId: string, refreshKey = 0) {
  return useDataFetch(
    mockGauges,
    async () => {
      const info = await api.getSystemInfo(hostId);
      try {
        const history = await api.getSystemMetricsHistory(hostId, '6h');
        return systemInfoToGauges(info, history);
      } catch {
        return systemInfoToGauges(info);
      }
    },
    [hostId, refreshKey]
  );
}

export function useSystemInfo(hostId: string, refreshKey = 0) {
  return useDataFetch(
    null,
    async () => api.getSystemInfo(hostId),
    [hostId, refreshKey]
  );
}

export function useMonitoringTrends(hostId: string, range: string = '6h', refreshKey = 0) {
  return useDataFetch(
    mockTrendCharts,
    async () => {
      const [history, info] = await Promise.all([
        api.getSystemMetricsHistory(hostId, range),
        api.getSystemInfo(hostId).catch(() => null),
      ]);
      return historyToCharts(history, info);
    },
    [hostId, range, refreshKey]
  );
}

export function useMonitoringProcesses(hostId: string, refreshKey = 0) {
  return useDataFetch(
    mockProcesses,
    async () => {
      const procs = await api.getSystemProcesses(hostId, 20, 'cpu');
      return systemProcessesToProcesses(procs);
    },
    [hostId, refreshKey]
  );
}

export function useMonitoringResources() {
  return useDataFetch(mockResources, async () => {
    try {
      return await api.getHostSummaries();
    } catch {
      const hosts = await api.getHosts();
      return hostsToResources(hosts);
    }
  });
}

export function useHost(hostId: string) {
  return useDataFetch(mockHost, async () => api.getHostById(hostId), [hostId]);
}
