export const DEMO_SCENARIOS = [
  { value: 'attention', label: '확인 필요', description: '장애와 수집 상태 점검' },
  { value: 'normal', label: '정상 운영', description: '모든 대상이 정상인 상태' },
  { value: 'empty', label: '첫 시작', description: '아직 대상이 없는 상태' },
  { value: 'partial-failure', label: '부분 수집 실패', description: '일부 데이터만 실패한 상태' },
] as const;

export type MockScenario = (typeof DEMO_SCENARIOS)[number]['value'];

const STORAGE_KEY = 'everyup_demo_scenario';

function isMockScenario(value: string | null): value is MockScenario {
  return value === 'attention' || value === 'normal' || value === 'empty' || value === 'partial-failure';
}

/** Selected through the Live Demo UI. URL support remains for older shared links. */
export function getDemoScenario(): MockScenario {
  if (typeof window === 'undefined') return 'attention';
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (isMockScenario(stored)) return stored;
  } catch {
    // Private browsing storage can be unavailable; the default still works.
  }
  const legacyQuery = new URLSearchParams(window.location.search).get('mockScenario');
  return isMockScenario(legacyQuery) ? legacyQuery : 'attention';
}

export function setDemoScenario(scenario: MockScenario) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, scenario);
  } catch {
    // A reload will fall back to the attention scenario when storage is blocked.
  }
}
