import type { ServiceStatus } from './common';

/**
 * 대시보드 서비스 카드 UI 모델 (뷰 레이어 전용).
 * API 응답 모델은 services/api/services.ts 의 Service를 참조.
 * useDashboardServices() 훅에서 API 응답 → 이 타입으로 변환.
 */
export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  latency: string;
  uptime: string;
  uptimeRaw?: number;
  icon: string;
  type?: 'http' | 'tcp';
  interval?: number;
  isActive?: boolean;
  url?: string;
  latencyHistory?: number[];
}
