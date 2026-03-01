// Environment configuration
// Vite exposes env variables on import.meta.env

export const env = {
  // Mock 데이터 사용 여부
  useMock: import.meta.env.VITE_USE_MOCK === 'true',

  // 라이브 데모 모드 (GitHub Pages)
  isDemoMode: import.meta.env.VITE_DEMO_MODE === 'true',

  // API Base URL
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',

  // Development mode
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

// 타입 안전성을 위한 환경 변수 타입 선언
declare global {
  interface ImportMetaEnv {
    VITE_USE_MOCK: string;
    VITE_DEMO_MODE: string;
    VITE_API_BASE_URL: string;
    VITE_API_TARGET: string;
  }
}
