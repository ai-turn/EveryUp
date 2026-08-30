// 보존 기간 옵션 라벨 — 기존의 "7 일 / Days" 이중 표기 대체.
export function retentionLabel(v: string): string {
  if (v === '1y') return '1년';
  return `${parseInt(v, 10)}일`;
}

// 수집 주기(초) 옵션 라벨 — 60초 이상은 분 단위로 표시.
export function intervalLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  return `${seconds / 60}분`;
}
