import { useState, useEffect, useRef } from 'react';
import { useAuth, PillConfig, SocialLinks } from '../contexts/AuthContext';
import { CHARACTER_AVATARS } from '../constants/avatars';
import { THEMES, CATEGORIES } from '../constants/config';
import { t } from '../constants/translations';
import { TranslationStrings } from '../constants/translations';
import { useTheme } from '../hooks/useTheme';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'avatar' | 'pills' | 'theme';

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/username' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
  { key: 'website', label: 'Website', placeholder: 'https://example.com' },
];

export function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const { user, profile, updateProfile, uploadAvatar, checkUsernameAvailable, signOut } = useAuth();
  const { theme: localTheme, setTheme: setLocalTheme } = useTheme();

  const [tab, setTab] = useState<Tab>('profile');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [pills, setPills] = useState<PillConfig[]>([]);
  const [bgColor, setBgColor] = useState('');
  const [bgHex, setBgHex] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPillLabel, setNewPillLabel] = useState('');
  const [newPillKeywords, setNewPillKeywords] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profile data when opened
  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setUsernameStatus('idle');
      setBio(profile.bio || '');
      setSocials(profile.social_links || {});
      setPills(profile.pills || CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const })));
      setBgColor(profile.background_color || '');
      setBgHex(profile.background_color || '');
      setTab('profile');
      setError('');
      setSaved(false);
    }
  }, [isOpen, profile]);

  // Sync theme from profile on load
  useEffect(() => {
    if (isOpen && profile?.theme && profile.theme !== localTheme) {
      setLocalTheme(profile.theme as any);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  // Username availability check (debounced)
  const handleUsernameChange = (value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(normalized);
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!normalized) return;
    if (!/^[a-z0-9_]{3,30}$/.test(normalized)) {
      setUsernameStatus('invalid');
      return;
    }
    if (normalized === profile?.username) return;
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(normalized);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  };

  const handleSaveProfile = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      if (username && username !== profile?.username) {
        if (usernameStatus === 'taken') throw new Error('That username is taken');
        if (usernameStatus === 'invalid') throw new Error('Username must be 3-30 chars: letters, numbers, underscores');
      }
      await updateProfile({
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        social_links: socials,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await uploadAvatar(file);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCharacterSelect = async (characterId: string) => {
    setError('');
    try {
      await updateProfile({ avatar_type: 'character', avatar_character: characterId, avatar_url: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set avatar');
    }
  };

  const handleInitialAvatar = async () => {
    setError('');
    try {
      await updateProfile({ avatar_type: 'initial', avatar_character: null, avatar_url: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set avatar');
    }
  };

  const handleThemeSelect = async (themeId: string) => {
    setLocalTheme(themeId as any);
    try {
      await updateProfile({ theme: themeId });
    } catch {
      // Theme still applies locally even if sync fails
    }
  };

  const handleBgColorChange = (color: string) => {
    setBgColor(color);
    setBgHex(color);
  };

  const handleBgHexChange = (hex: string) => {
    setBgHex(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setBgColor(hex);
    }
  };

  const handleSaveTheme = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({
        theme: localTheme,
        background_color: bgColor || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClearBg = async () => {
    setBgColor('');
    setBgHex('');
    try {
      await updateProfile({ background_color: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear');
    }
  };

  // Pill management
  const togglePill = (pillId: string) => {
    setPills((prev) => {
      const exists = prev.find((p) => p.id === pillId);
      if (exists) {
        return prev.filter((p) => p.id !== pillId);
      }
      // Add back in default order position
      const allPills: PillConfig[] = [
        ...CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const })),
        ...prev.filter((p) => p.type === 'custom'),
      ];
      const ordered = allPills.filter((p) => prev.some((pp) => pp.id === p.id) || p.id === pillId);
      return ordered;
    });
  };

  const addCustomPill = () => {
    if (!newPillLabel.trim()) return;
    const id = `custom-${Date.now()}`;
    setPills((prev) => [...prev, { id, type: 'custom', label: newPillLabel.trim(), keywords: newPillKeywords.trim() || undefined }]);
    setNewPillLabel('');
    setNewPillKeywords('');
  };

  const removeCustomPill = (pillId: string) => {
    setPills((prev) => prev.filter((p) => p.id !== pillId));
  };

  const movePill = (index: number, direction: -1 | 1) => {
    setPills((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSavePills = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({ pills });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  const renderAvatar = (size: 'lg' | 'sm' = 'lg') => {
    const cls = size === 'lg' ? 'profile-avatar' : 'profile-avatar-sm';
    if (profile?.avatar_type === 'upload' && profile.avatar_url) {
      return <img src={profile.avatar_url} alt="Profile" className={cls} />;
    }
    if (profile?.avatar_type === 'character' && profile.avatar_character) {
      const char = CHARACTER_AVATARS.find((c) => c.id === profile.avatar_character);
      if (char) {
        return (
          <div className={cls} style={{ background: char.bg, fontSize: size === 'lg' ? '2rem' : '1.2rem' }}>
            {char.emoji}
          </div>
        );
      }
    }
    const initial = (profile?.display_name || user?.email || '?')[0].toUpperCase();
    return <div className={`${cls} profile-avatar-fallback`}>{initial}</div>;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'avatar', label: 'Avatar' },
    { id: 'pills', label: 'Pills' },
    { id: 'theme', label: 'Theme' },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog profile-dialog-expanded" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>

        <h2 className="dialog-title">Your Space</h2>

        <div className="profile-tabs">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.id}
              type="button"
              className={`profile-tab ${tab === tabItem.id ? 'active' : ''}`}
              onClick={() => setTab(tabItem.id)}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {error && <div className="dialog-error">{error}</div>}
        {saved && <div className="dialog-success">Saved!</div>}

        {tab === 'profile' && (
          <div className="profile-tab-content">
            <div className="profile-avatar-row">
              {renderAvatar('lg')}
              <div>
                <div className="profile-email">{user?.email}</div>
                {profile?.username && (
                  <button
                    type="button"
                    className="profile-username profile-username-link"
                    title="View your public profile"
                    onClick={() => {
                      const name = profile.username;
                      onClose();
                      window.history.pushState({}, '', `/@${name}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                  >
                    @{profile.username}
                  </button>
                )}
              </div>
            </div>

            <div className="sign-in-form">
              <label htmlFor="profile-display-name">Display name</label>
              <input
                id="profile-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                maxLength={50}
              />

              <label htmlFor="profile-username">Username (for your unique URL)</label>
              <input
                id="profile-username"
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="yourname"
                maxLength={30}
              />
              {usernameStatus === 'checking' && <span className="username-hint">Checking…</span>}
              {usernameStatus === 'available' && <span className="username-hint available">✓ Available</span>}
              {usernameStatus === 'taken' && <span className="username-hint taken">✗ Taken</span>}
              {usernameStatus === 'invalid' && <span className="username-hint taken">3-30 chars: a-z, 0-9, _</span>}

              <label htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself…"
                maxLength={280}
                rows={3}
                className="profile-textarea"
              />

              <label>Social links</label>
              {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="social-field">
                  <span className="social-label">{label}</span>
                  <input
                    type="url"
                    value={socials[key] || ''}
                    onChange={(e) => setSocials((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}

              <button type="button" className="sign-in-button primary-button" onClick={handleSaveProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}

        {tab === 'avatar' && (
          <div className="profile-tab-content">
            <div className="profile-avatar-row">
              {renderAvatar('lg')}
              <div>
                <button type="button" className="sign-in-button secondary-button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </div>
            </div>

            <label className="profile-section-label">Or pick a character</label>
            <div className="character-grid">
              {CHARACTER_AVATARS.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  className={`character-option ${profile?.avatar_type === 'character' && profile.avatar_character === char.id ? 'selected' : ''}`}
                  onClick={() => handleCharacterSelect(char.id)}
                  title={char.name}
                >
                  <span className="character-emoji" style={{ background: char.bg }}>{char.emoji}</span>
                  <span className="character-name">{char.name}</span>
                </button>
              ))}
            </div>

            <button type="button" className="link-button" onClick={handleInitialAvatar}>
              Use initial letter instead
            </button>
          </div>
        )}

        {tab === 'pills' && (
          <div className="profile-tab-content">
            <p className="profile-hint">Choose which pills appear on your space, in order. Add your own custom topics too.</p>

            <label className="profile-section-label">Your pills (in order)</label>
            <div className="pill-list">
              {pills.map((pill, index) => {
                const cat = CATEGORIES.find((c) => c.id === pill.id);
                const label = pill.type === 'custom' ? pill.label : (cat ? t(cat.i18nKey as keyof TranslationStrings) || cat.id : pill.id);
                const icon = pill.type === 'custom' ? '📌' : (cat?.icon || '');
                return (
                  <div key={pill.id} className="pill-row">
                    <span className="pill-icon">{icon}</span>
                    <span className="pill-label">{label}</span>
                    {pill.type === 'custom' && (
                      <button type="button" className="pill-remove" onClick={() => removeCustomPill(pill.id)} aria-label="Remove">×</button>
                    )}
                    <div className="pill-reorder">
                      <button type="button" onClick={() => movePill(index, -1)} disabled={index === 0} aria-label="Move up">↑</button>
                      <button type="button" onClick={() => movePill(index, 1)} disabled={index === pills.length - 1} aria-label="Move down">↓</button>
                    </div>
                  </div>
                );
              })}
              {pills.length === 0 && <p className="profile-hint">No pills selected — add some below.</p>}
            </div>

            <label className="profile-section-label">Available categories</label>
            <div className="pill-toggle-grid">
              {CATEGORIES.map((cat) => {
                const active = pills.some((p) => p.id === cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`pill-toggle ${active ? 'active' : ''}`}
                    onClick={() => togglePill(cat.id)}
                  >
                    <span>{cat.icon}</span> {t(cat.i18nKey as keyof TranslationStrings) || cat.id}
                  </button>
                );
              })}
            </div>

            <label className="profile-section-label">Add a custom topic</label>
            <div className="sign-in-form">
              <input
                type="text"
                value={newPillLabel}
                onChange={(e) => setNewPillLabel(e.target.value)}
                placeholder="Topic name (e.g. Dinosaurs)"
                maxLength={30}
              />
              <input
                type="text"
                value={newPillKeywords}
                onChange={(e) => setNewPillKeywords(e.target.value)}
                placeholder="Keywords (e.g. dinosaur, t-rex, fossil)"
                maxLength={100}
              />
              <button type="button" className="sign-in-button secondary-button" onClick={addCustomPill} disabled={!newPillLabel.trim()}>
                Add custom pill
              </button>
            </div>

            <button type="button" className="sign-in-button primary-button" onClick={handleSavePills} disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Saving…' : 'Save Pills'}
            </button>
          </div>
        )}

        {tab === 'theme' && (
          <div className="profile-tab-content">
            <label className="profile-section-label">Theme</label>
            <div className="theme-grid">
              {THEMES.map((themeOption) => (
                <button
                  key={themeOption.id}
                  type="button"
                  className={`theme-option ${localTheme === themeOption.id ? 'selected' : ''}`}
                  onClick={() => handleThemeSelect(themeOption.id)}
                >
                  <span className="theme-icon">{themeOption.icon}</span>
                  <span className="theme-name">{themeOption.name}</span>
                </button>
              ))}
            </div>

            <label className="profile-section-label">Background color (overrides theme)</label>
            <div className="color-picker-row">
              <input
                type="color"
                value={bgColor || '#1e293b'}
                onChange={(e) => handleBgColorChange(e.target.value)}
                className="color-wheel"
                aria-label="Pick background color"
              />
              <input
                type="text"
                value={bgHex}
                onChange={(e) => handleBgHexChange(e.target.value)}
                placeholder="#1e293b"
                maxLength={7}
                className="hex-input"
                aria-label="Hex color code"
              />
              {(bgColor || profile?.background_color) && (
                <button type="button" className="link-button" onClick={handleClearBg}>
                  Clear
                </button>
              )}
            </div>
            {bgColor && (
              <div className="color-preview" style={{ background: bgColor }}>
                <span>Preview</span>
              </div>
            )}

            <button type="button" className="sign-in-button primary-button" onClick={handleSaveTheme} disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Saving…' : 'Save Theme'}
            </button>
          </div>
        )}

        <div className="profile-footer">
          <button type="button" className="sign-in-button secondary-button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
