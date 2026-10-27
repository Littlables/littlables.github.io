import { useEffect } from 'react';

/**
 * Prevents the page behind a modal/dialog from scrolling while it's open.
 * Restores the previous overflow when the dialog closes or unmounts.
 */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
