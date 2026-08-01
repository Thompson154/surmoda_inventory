import { useEffect, useState } from 'react';

/**
 * Debounces a value by `delay` milliseconds.
 * Only updates after the caller stops changing the value for `delay` ms.
 *
 * Usage: const debouncedQ = useDebounce(q, 300);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
