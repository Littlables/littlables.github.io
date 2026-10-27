import React, { useEffect, useRef } from 'react';
import { ThemeId } from '../types';
import { THEMES } from '../constants/config';
import { useSystemFont } from '../hooks/useSystemFont';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { systemFont, setSystemFont } = useSystemFont();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="site-info-dialog settings-dialog"
      id="settings-dialog"
      aria-labelledby="settings-dialog-title"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div className="settings-dialog-header">
        <h2 id="settings-dialog-title" className="settings-dialog-title">
          <svg
            className="settings-dialog-title-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Settings</span>
        </h2>
        <button
          className="site-info-close settings-dialog-close"
          type="button"
          aria-label="Close settings"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <label htmlFor="theme-select" className="settings-section-label">
            Theme
          </label>
          <div className="theme-picker-container" title="Select Theme">
            <span className="theme-select-icon" aria-hidden="true">🎨</span>
            <select
              id="theme-select"
              className="theme-dropdown-select"
              aria-label="Select Theme"
              data-umami-event="Select-Theme"
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
        </div>

        <div className="settings-theme-grid" role="radiogroup" aria-label="Color Themes">
          {THEMES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`settings-theme-option ${isSelected ? 'active' : ''}`}
                data-umami-event="Select-Theme"
                data-umami-event-theme={item.id}
                onClick={() => onThemeChange(item.id)}
              >
                <span className="settings-theme-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="settings-theme-name">{item.name}</span>
                {isSelected && (
                  <span className="settings-theme-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <span className="settings-section-label">Fonts</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={systemFont}
            onChange={(e) => setSystemFont(e.target.checked)}
          />
          <span>Use system font</span>
        </label>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--news-text-muted)' }}>
          Off by default. When on, the site uses your device's system font instead of Fredoka, Quicksand, and Varela Round.
        </p>
      </div>
    </dialog>
  );
};
