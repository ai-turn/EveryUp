import { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const defaults = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/**
 * Dashboard — 4개 패널이 조합된 그리드 레이아웃.
 * 전체 시스템 현황을 한눈에 파악하는 대시보드의 성격을 표현.
 * 좌상단 큰 패널(메인 KPI) + 우측/하단 작은 패널(세부 지표).
 */
export function IconDashboard({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
    </svg>
  );
}

/**
 * Health Check — 심박 펄스 라인 + 체크 표시.
 * 서비스의 생사 여부를 주기적으로 확인하는 헬스체크의 핵심을 표현.
 * 평탄한 라인에서 한 번 뛰는 펄스가 "살아있음"을 상징.
 */
export function IconHealthCheck({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <polyline points="2,13 6,13 9,6 12,18 15,10 18,13 22,13" />
      <circle cx="18" cy="7" r="4" strokeWidth="1.8" />
      <polyline points="16.5,7 17.5,8 19.5,6" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Logs — 터미널 프롬프트 라인이 쌓인 모습.
 * 로그 스트림이 연속적으로 흘러가는 터미널/콘솔 환경을 표현.
 * 각 줄의 길이가 달라 실제 로그 출력의 불규칙함을 반영.
 */
export function IconLogs({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="8" x2="11" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="14" y2="16" />
      <circle cx="5" cy="8" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="16" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Infra Monitoring — 서버 랙 + 실시간 파동.
 * 물리/가상 서버의 CPU, 메모리 등 리소스를 실시간으로 관찰하는 인프라 모니터링을 표현.
 * 서버 박스 위에 퍼져나가는 신호선이 "감시 중"을 상징.
 */
export function IconInfra({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
      <line x1="15" y1="7" x2="17" y2="7" />
      <line x1="15" y1="17" x2="17" y2="17" />
    </svg>
  );
}

/**
 * Alerts — 종 모양 + 번개 강조.
 * 임계치 초과 시 즉시 알려주는 경보 시스템을 표현.
 * 클래식한 벨 위에 번개가 치는 형상으로 "긴급 알림"의 즉시성을 강조.
 */
export function IconAlerts({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M10 5a2 2 0 1 1 4 0 7 7 0 0 1 4 6v3a2 2 0 0 0 1 1.73V17H5v-1.27A2 2 0 0 0 6 14v-3a7 7 0 0 1 4-6" />
      <path d="M9 17a3 3 0 0 0 6 0" />
      <path d="M20 4l-1.5 3 2.5.5-3 3" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Settings — 2개 슬라이더 트랙.
 * 세밀한 설정값 조정이 가능한 컨트롤 패널을 표현.
 * 기어보다는 이퀄라이저/슬라이더가 "구성 가능한 설정"을 더 직관적으로 전달.
 */
export function IconSettings({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="15" cy="16" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
