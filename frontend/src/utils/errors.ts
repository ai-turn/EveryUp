import i18n from '../i18n';

/**
 * Structured API error that carries the error code from the backend.
 * Use `getErrorMessage(error)` to resolve a user-facing localized message.
 */
export class ApiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Resolves a user-facing localized message from any error.
 *
 * Priority:
 * 1. ApiError with known code → errors namespace i18n key
 * 2. ApiError with unknown code → raw error.message (backend fallback)
 * 3. Generic Error → error.message
 * 4. Unknown → generic fallback message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code) {
    const translated = i18n.t(error.code, { ns: 'errors' });
    // i18next returns the key itself when no translation is found
    if (translated !== error.code) {
      return translated;
    }
    // No translation → fall back to the raw message from backend
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return i18n.t('UNKNOWN_ERROR', { ns: 'errors' });
}
