// 보존 기간 옵션 라벨 — 현재 언어로만 표시 (기존의 "7 일 / Days" 이중 표기 대체).
export function retentionLabel(v: string, lang: string): string {
  const ko = lang.startsWith('ko');
  if (v === '1y') return ko ? '1년' : '1 Year';
  const n = parseInt(v, 10);
  return ko ? `${n}일` : `${n} ${n === 1 ? 'Day' : 'Days'}`;
}

// 수집 주기(초) 옵션 라벨 — 60초 이상은 분 단위로 표시.
export function intervalLabel(seconds: number, lang: string): string {
  const ko = lang.startsWith('ko');
  if (seconds < 60) return ko ? `${seconds}초` : `${seconds}s`;
  const m = seconds / 60;
  return ko ? `${m}분` : `${m}m`;
}
