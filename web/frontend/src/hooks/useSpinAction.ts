import { useCallback, useRef, useState } from 'react';

/**
 * Briefly flags `spinning=true` after invoking `action`, then resets after
 * `durationMs`. Used to give refresh buttons a tactile spin animation so
 * users can see the click was acknowledged even if the underlying fetch
 * resolves from cache instantly.
 */
export function useSpinAction(action: () => void, durationMs = 600) {
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    action();
    if (timer.current) clearTimeout(timer.current);
    setSpinning(true);
    timer.current = setTimeout(() => setSpinning(false), durationMs);
  }, [action, durationMs]);

  return { spinning, trigger };
}
