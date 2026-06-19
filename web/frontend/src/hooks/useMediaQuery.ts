import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const mql = window.matchMedia(query);
    const handler = () => onStoreChange();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  };

  const getSnapshot = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
