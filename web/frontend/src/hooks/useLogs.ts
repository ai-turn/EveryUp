import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';

export function useLogs(params?: { level?: string; limit?: string }) {
  return useDataFetch(
    [],
    async () => api.getLogs(params),
    [params?.level, params?.limit]
  );
}
