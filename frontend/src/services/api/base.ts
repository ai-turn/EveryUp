import { env } from '../../config/env';
import { mockRouter } from '../mockRouter';
import { ApiError } from '../../utils/errors';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
  };
}

export type RequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export function createRequestFn(): RequestFn {
  const baseUrl = env.apiBaseUrl;

  return async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    if (env.useMock) return mockRouter<T>(endpoint, options?.method);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (response.status === 401) {
      localStorage.removeItem('everyup_user');
      window.location.href = '/login';
      throw new ApiError('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Parse JSON regardless of HTTP status to extract structured error codes
    let json: ApiResponse<T>;
    try {
      json = await response.json();
    } catch {
      throw new ApiError(`HTTP Error: ${response.status}`, 'UNKNOWN_ERROR', response.status);
    }

    if (!json.success) {
      throw new ApiError(
        json.error?.message || 'API Error',
        json.error?.code || 'UNKNOWN_ERROR',
        response.status,
      );
    }

    return json.data as T;
  };
}
