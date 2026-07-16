import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';
import { mockGauges, mockCharts as mockTrendCharts } from '../mocks/infra';
import { systemInfoToGauges, historyToCharts } from '../utils/systemTransform';

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
