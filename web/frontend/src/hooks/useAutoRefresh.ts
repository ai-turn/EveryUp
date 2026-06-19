import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook for auto-refreshing data at a specified interval
 * @param callback - Function to call on each refresh
 * @param interval - Interval in milliseconds
 * @param enabled - Whether auto-refresh is enabled
 */
export function useAutoRefresh(
  callback: () => void,
  interval: number,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      savedCallback.current();
    };

    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }, [interval, enabled]);

  // Manual refresh function
  const refresh = useCallback(() => {
    savedCallback.current();
  }, []);

  return { refresh };
}
