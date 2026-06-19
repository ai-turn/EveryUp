import { useDataFetch } from './useDataFetch';
import { mockProtocols, mockConfigGroups } from '../mocks/settings';

// TODO: API 미구현 — 백엔드 설정 프로토콜 엔드포인트 추가 시 교체
export function useSettingsProtocols() {
  return useDataFetch(mockProtocols, async () => mockProtocols);
}

// TODO: API 미구현 — 백엔드 설정 그룹 엔드포인트 추가 시 교체
export function useSettingsConfigGroups() {
  return useDataFetch(mockConfigGroups, async () => mockConfigGroups);
}
