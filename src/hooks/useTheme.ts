import { useState, useEffect, useCallback } from 'react';
import { ThemeId } from '../types';
import { THEMES, SAVED_THEME_KEY } from '../constants/config';

export function useTheme() {
  const getSystemTheme = (): ThemeId => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  };

  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(SAVED_THEME_KEY) as ThemeId;
      if (saved && THEMES.some(t => t.id === saved)) {
        return saved;
      }
    } catch {}
    return getSystemTheme();
  });

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem(SAVED_THEME_KEY, newTheme);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        try {
          if (!localStorage.getItem(SAVED_THEME_KEY)) {
            const systemTheme: ThemeId = e.matches ? 'light' : 'dark';
            setThemeState(systemTheme);
            document.documentElement.setAttribute('data-theme', systemTheme);
          }
        } catch {}
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, [theme]);

  return { theme, setTheme, themes: THEMES };
}
