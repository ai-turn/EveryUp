import { useState, useEffect } from 'react';

/**
 * Delays updating the returned value until the input has stopped changing
 * for the specified delay duration (default: 300ms).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
