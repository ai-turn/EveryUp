import { api } from '../services/api';
import { useDataFetch } from './useDataFetch';
import { mockNotificationRules, mockChannels } from '../mocks/alerts';

export function useNotificationChannels() {
  return useDataFetch(mockChannels, async () => api.getNotificationChannels());
}

// TODO: API 미구현 — 백엔드 알림 규칙 조회 엔드포인트 추가 시 교체
export function useNotificationRules() {
  return useDataFetch(mockNotificationRules, async () => mockNotificationRules);
}
