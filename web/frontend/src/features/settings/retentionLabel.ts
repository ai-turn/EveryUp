// 보존 기간 옵션 라벨 — 현재 언어로만 표시 (기존의 "7 일 / Days" 이중 표기 대체).
export function retentionLabel(v: string, lang: string): string {
  const ko = lang.startsWith('ko');
  if (v === '1y') return ko ? '1년' : '1 Year';
  const n = parseInt(v, 10);
  return ko ? `${n}일` : `${n} ${n === 1 ? 'Day' : 'Days'}`;
}
