import { lazy, type ComponentType } from 'react';

// Wraps React.lazy so a stale chunk 404 (typical after a deploy that
// replaced the build's hashed assets while the user's tab still holds
// the previous index.html) triggers exactly one hard reload to pick up
// the fresh chunk URLs. A sessionStorage flag guards against an infinite
// reload loop if the chunk is genuinely missing.
const RELOAD_FLAG = 'chunk-reload-attempted';

function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'ChunkLoadError') return true;
  return /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    err.message,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;
      if (sessionStorage.getItem(RELOAD_FLAG)) throw err;
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
      return new Promise<{ default: T }>(() => {});
    }
  });
}
