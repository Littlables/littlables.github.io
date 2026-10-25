import React from 'react';
import { t } from '../constants/translations';
import { useAuth } from '../contexts/AuthContext';
import { CHARACTER_AVATARS } from '../constants/avatars';

interface HeaderProps {
  onHomeClick: () => void;
  onOpenSettings: () => void;
  onOpenSignIn: () => void;
  onOpenProfile: () => void;
  isLoading: boolean;
  /** Board branding override: shown instead of the Littlables logo on board pages */
  brandName?: string;
  brandLogoUrl?: string | null;
  /** True when the GitHub admin session is active (enables long-press story editing) */
  isAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onHomeClick,
  onOpenSettings,
  onOpenSignIn,
  onOpenProfile,
  isLoading,
  brandName,
  brandLogoUrl,
  isAdmin
}) => {
  const { user, profile } = useAuth();

  const character =
    profile?.avatar_type === 'character'
      ? CHARACTER_AVATARS.find((c) => c.id === profile.avatar_character) || null
      : null;

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
        aria-label={`${brandName || t('headerTitle') || 'littlables'} — Refresh Stories`}
        onClick={handleBrandClick}
      >
        {brandLogoUrl ? (
          <img
            className="widget-brand-icon board-brand-logo"
            src={brandLogoUrl}
            width="28"
            height="28"
            alt={`${brandName || 'Board'} logo`}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
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
        )}
        <span id="widget-title-text">{brandName || t('headerTitle') || 'littlables'}</span>
      </button>

      <div className="news-header-controls">
        <button
          id="playground-3d-btn"
          type="button"
          className="header-icon-button header-3d-button"
          title="3D"
          aria-label="Open 3D playground"
          data-umami-event="Open-3D-Playground"
          onClick={() => window.open('https://playground.google/g/viMkwl', '_blank', 'noopener,noreferrer')}
        >
          3D
        </button>

        {!user && (
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
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7.5" cy="7.5" r="2.5" />
            <circle cx="16.5" cy="7.5" r="2.5" />
            <circle cx="12" cy="13" r="6" />
            <circle cx="10" cy="12" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="14" cy="12" r="0.9" fill="currentColor" stroke="none" />
            <ellipse cx="12" cy="15.2" rx="1.8" ry="1.2" />
          </svg>
          </button>
        )}

        {isAdmin && (
          <span
            className="header-admin-badge"
            title="Admin mode — long-press a story to edit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              background: '#7c3aed',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            🛠️ Admin
          </span>
        )}
        {user ? (
          <button
            type="button"
            className="header-auth-button header-avatar-button"
            title="Your profile"
            aria-label="Open your profile"
            onClick={onOpenProfile}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="header-avatar" />
            ) : character ? (
              <span
                className="header-avatar"
                style={{ background: character.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}
              >
                <span className="avatar-emoji-glyph">{character.emoji}</span>
              </span>
            ) : (
              <span className="header-avatar-fallback">
                {(profile?.display_name || user.email || '?')[0].toUpperCase()}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            className="header-auth-button header-signin-button"
            onClick={onOpenSignIn}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};

