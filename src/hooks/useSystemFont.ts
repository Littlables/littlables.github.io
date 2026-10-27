import { useState, useEffect, useCallback } from 'react';

// Client-side only: whether the reader prefers the device system font over
// the site's webfonts (Fredoka, Quicksand, Varela Round). Off by default,
// so the webfonts show unless the reader opts out in theme settings.
// Stored in localStorage, never synced to the account.
const SYSTEM_FONT_KEY = 'littlables-use-system-font';

export function useSystemFont() {
  const [systemFont, setSystemFontState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SYSTEM_FONT_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const setSystemFont = useCallback((next: boolean) => {
    setSystemFontState(next);
    try {
      localStorage.setItem(SYSTEM_FONT_KEY, next ? 'true' : 'false');
    } catch {}
  }, []);

  useEffect(() => {
    if (systemFont) {
      document.documentElement.setAttribute('data-system-font', 'true');
    } else {
      document.documentElement.removeAttribute('data-system-font');
    }
  }, [systemFont]);

  return { systemFont, setSystemFont };
}
