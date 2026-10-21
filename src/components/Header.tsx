import React from 'react';
import { t } from '../constants/translations';

interface HeaderProps {
  onHomeClick: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onRefresh,
  onOpenSettings,
  isLoading
}) => {
  const handleBrandClick = () => {
    if (isLoading) return;
    try {
      if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
        window.umami.track('Home-Logo-Refresh');
      }
    } catch {}
    onHomeClick();
  };

  return (
    <header className="news-widget-header">
      <button
        type="button"
        className="news-widget-title"
        id="widget-main-title"
        title="Refresh Stories"
        aria-label={`${t('headerTitle') || 'Littlables'} — Refresh Stories`}
        onClick={handleBrandClick}
      >
        <img
          className="widget-brand-icon"
          src="/favicon-48x48.png"
          width="28"
          height="28"
          alt="Littlables logo"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <span id="widget-title-text">{t('headerTitle') || 'Littlables'}</span>
      </button>

      <div className="news-header-controls">
        <button
          id="refresh-news-btn"
          type="button"
          className={`header-icon-button refresh-news-button ${isLoading ? 'is-loading' : ''}`}
          title={t('refreshBtn') || 'Refresh Stories'}
          aria-label={isLoading ? 'Refreshing stories' : (t('refreshBtn') || 'Refresh Stories')}
          data-umami-event="Refresh-Feed"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>

        <button
          id="settings-btn"
          type="button"
          className="header-icon-button settings-cog-button"
          title="Settings"
          aria-label="Open Settings"
          data-umami-event="Open-Settings"
          onClick={onOpenSettings}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

