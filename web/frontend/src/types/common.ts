/**
 * UI 전용 공통 타입 모음 (뷰 레이어).
 * API 응답 타입은 services/api/ 각 도메인 파일을 참조.
 */

export type ServiceStatus = 'healthy' | 'degraded' | 'warning' | 'offline';

export interface NavItem {
  icon: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface Incident {
  id: string;
  time: string;
  type: 'error' | 'warning' | 'success' | 'info';
  serviceName: string;
  message: string;
  serviceId?: string;
}