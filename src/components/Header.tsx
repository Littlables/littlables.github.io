import React from 'react';
import { ThemeId } from '../types';
import { THEMES } from '../constants/config';
import { t } from '../constants/translations';

interface HeaderProps {
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onThemeChange,
  onRefresh,
  isLoading
}) => {
  return (
    <header className="news-widget-header">
      <div className="news-widget-title" id="widget-main-title">
        <img
          className="widget-brand-icon"
          src="/favicon-48x48.png"
          width="32"
          height="32"
          alt="Littlables logo"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <span id="widget-title-text">{t('headerTitle') || 'Littlables Feed'}</span>
      </div>
      <div className="news-header-controls">
        <div className="theme-picker-container" title="Select Theme">
          <span className="theme-select-icon" aria-hidden="true">🎨</span>
          <select
            id="theme-select"
            className="theme-dropdown-select"
            aria-label="Select Theme"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemeId)}
          >
            {THEMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.icon} {item.name}
              </option>
            ))}
          </select>
        </div>
        <button
          id="refresh-news-btn"
          className="refresh-news-button"
          title="Refresh Stories"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? '⏳ Refreshing...' : (t('refreshBtn') || '🔄 Refresh Feed')}
        </button>
      </div>
    </header>
  );
};
