import { useState, useEffect, useCallback } from 'react';
import { ThemeId } from '../types';
import { DEFAULT_THEME, THEMES, SAVED_THEME_KEY } from '../constants/config';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem(SAVED_THEME_KEY) as ThemeId;
      if (saved && THEMES.some(t => t.id === saved)) {
        return saved;
      }
    } catch {}
    return DEFAULT_THEME;
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
  }, [theme]);

  return { theme, setTheme, themes: THEMES };
}
