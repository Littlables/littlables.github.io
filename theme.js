    /**
     * =========================================================
     * THEME MANAGER (Mini Quest: 6 Visual Themes & Profile Ready)
     * =========================================================
     * Manages visual theme selection, local storage persistence, and provides
     * a clean integration hook for upcoming Supabase User Auth & Profiles.
     */
    const THEME_CONFIG = {
      storageKey: 'selected_theme',
      defaultTheme: 'dark',
      availableThemes: [
        { id: 'dark', name: 'Dark Mode', icon: '🌙' },
        { id: 'dark-purple', name: 'Dark Purple', icon: '🔮' },
        { id: 'light', name: 'Light Mode', icon: '☀️' },
        { id: 'rainbow', name: 'Rainbow', icon: '🌈' },
        { id: 'pastel-rainbow', name: 'Pastel Rainbow', icon: '🦄' },
        { id: 'pink', name: 'Pretty Pink', icon: '💖' }
      ]
    };

    const ThemeManager = {
      getSystemDefaultTheme() {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          return 'light';
        }
        return 'dark';
      },

      getSavedTheme() {
        try {
          const saved = localStorage.getItem(THEME_CONFIG.storageKey);
          if (saved && THEME_CONFIG.availableThemes.some(t => t.id === saved)) {
            return saved;
          }
        } catch (e) {
          console.warn("Theme storage read notice:", e);
        }
        // Fall back to device setting (light/dark) before any explicit user selection
        return this.getSystemDefaultTheme();
      },

      setTheme(themeId, syncToProfile = true) {
        if (!THEME_CONFIG.availableThemes.some(t => t.id === themeId)) {
          themeId = this.getSystemDefaultTheme();
        }

        document.documentElement.setAttribute('data-theme', themeId);
        try {
          localStorage.setItem(THEME_CONFIG.storageKey, themeId);
        } catch (e) {
          console.warn("Theme storage save notice:", e);
        }

        const selectEl = document.getElementById('theme-select');
        if (selectEl && selectEl.value !== themeId) {
          selectEl.value = themeId;
        }

        // Future Profile / Auth sync hook
        if (syncToProfile && typeof syncThemeToUserProfile === 'function') {
          syncThemeToUserProfile(themeId);
        }
      },

      init() {
        const hasExplicitChoice = Boolean(localStorage.getItem(THEME_CONFIG.storageKey));
        const theme = this.getSavedTheme();

        if (hasExplicitChoice) {
          this.setTheme(theme, false);
        } else {
          // Apply system preference without setting localStorage key until user explicitly interacts
          document.documentElement.setAttribute('data-theme', theme);
          const selectEl = document.getElementById('theme-select');
          if (selectEl) selectEl.value = theme;
        }

        const selectEl = document.getElementById('theme-select');
        if (selectEl) {
          selectEl.value = theme;
          selectEl.addEventListener('change', (e) => {
            this.setTheme(e.target.value, true);
          });
        }

        // Automatically follow device dark/light mode if user hasn't made an explicit selection yet
        if (typeof window !== 'undefined' && window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
          const handleSystemThemeChange = (e) => {
            try {
              if (!localStorage.getItem(THEME_CONFIG.storageKey)) {
                const systemTheme = e.matches ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', systemTheme);
                if (selectEl) selectEl.value = systemTheme;
              }
            } catch (err) {}
          };

          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
          } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleSystemThemeChange);
          }
        }
      }
    };

    /**
     * Profile sync hook: When user auth and profiles are enabled,
     * this will persist the theme preference to the user's account in Supabase.
     */
    async function syncThemeToUserProfile(themeId) {
      if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.auth) {
        try {
          const { data } = await supabaseClient.auth.getUser();
          if (data && data.user) {
            await supabaseClient
              .from('user_profiles')
              .upsert({ user_id: data.user.id, preferred_theme: themeId, updated_at: new Date().toISOString() });
          }
        } catch (err) {
          console.warn("User profile theme sync notice:", err);
        }
      }
    }

    ThemeManager.init();

