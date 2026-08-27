/* ============================================
   useDebounce HOOK
   Delays updating a value until it has stopped
   changing for the given delay — prevents firing
   a network request on every slider tick or
   keystroke.
============================================ */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    // If value changes again before the delay finishes,
    // cancel the pending update — only the latest matters.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
