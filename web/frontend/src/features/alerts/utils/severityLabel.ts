// 심각도 라벨의 단일 출처. 규칙 표·편집 폼·필터·발송 이력이 각자 다른 문구를
// 쓰고 있었다 (긴급 / 심각 / 'Critical' / 원시 'critical').
export const SEVERITY_LABELS: Record<string, string> = {
  critical: '심각',
  warning: '경고',
  info: '정보',
};

export function severityLabel(severity: string): string {
  return SEVERITY_LABELS[severity] ?? severity;
}
