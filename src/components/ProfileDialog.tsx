import { useState, useEffect, useRef } from 'react';
import { useAuth, PillConfig, SocialLinks } from '../contexts/AuthContext';
import { CHARACTER_AVATARS } from '../constants/avatars';
import { THEMES, CATEGORIES } from '../constants/config';
import { INTEREST_KEYWORDS, INTEREST_KEYWORD_GROUPS } from '../constants/interestKeywords';
import {
  Board,
  slugify,
  ensureUniqueSlug,
  getUserBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  reorderBoards,
  uploadBoardLogo,
} from '../services/boardService';
import { t } from '../constants/translations';
import { TranslationStrings } from '../constants/translations';
import { useTheme } from '../hooks/useTheme';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notify: (message: string, kind?: 'success' | 'error') => void;
}

type Tab = 'profile' | 'avatar' | 'interests' | 'theme' | 'boards';

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: 'twitter', label: 'X / Twitter', placeholder: '@username' },
  { key: 'instagram', label: 'Instagram', placeholder: '@username' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@username' },
  { key: 'youtube', label: 'YouTube', placeholder: '@handle' },
  { key: 'website', label: 'Website', placeholder: 'yoursite.com' },
];

// Build a full profile URL from a bare username per platform
const SOCIAL_URL_BUILDERS: Record<string, (username: string) => string> = {
  twitter: (u) => `https://x.com/${u}`,
  instagram: (u) => `https://instagram.com/${u}`,
  tiktok: (u) => `https://tiktok.com/@${u}`,
  youtube: (u) => `https://youtube.com/@${u}`,
  website: (u) => `https://${u}`,
};

/** Accepts either a full link or just a username and returns a full URL. */
function normalizeSocialLink(key: string, value: string): string {
  const v = (value || '').trim().replace(/^\/+/, '');
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v; // full link pasted — use as-is
  if (key === 'website' || v.includes('.')) return `https://${v}`; // bare domain
  const username = v.replace(/^@+/, ''); // bare username
  const build = SOCIAL_URL_BUILDERS[key];
  return build ? build(username) : v;
}

export function ProfileDialog({ isOpen, onClose, notify }: ProfileDialogProps) {
  const { user, profile, updateProfile, uploadAvatarFile, checkUsernameAvailable, signOut } = useAuth();
  const { theme: localTheme, setTheme: setLocalTheme } = useTheme();

  const [tab, setTab] = useState<Tab>('profile');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [pills, setPills] = useState<PillConfig[]>([]);
  // Boards
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  interface EditingBoard {
    id: string | null; // null = new board
    name: string;
    slug: string;
    description: string;
    logoUrl: string | null; // existing URL or blob preview
    logoFile: File | null;
    theme: string; // '' = inherit profile theme
    bgColor: string; // '' = inherit
    pills: PillConfig[];
  }
  const [editingBoard, setEditingBoard] = useState<EditingBoard | null>(null);
  const boardLogoRef = useRef<HTMLInputElement>(null);
  const [bgColor, setBgColor] = useState('');
  const [bgHex, setBgHex] = useState('');
  // The active theme's background color, so the wheel reflects the current
  // theme when no custom color is picked
  const [themeBg, setThemeBg] = useState('');
  const [useViewerThemeForBoards, setUseViewerThemeForBoards] = useState(false);
  const [saving, setSaving] = useState(false);
  // Save/error feedback goes through the app-level toast popover, so it
  // floats above the layout and survives the dialog being closed
  const setError = (msg: string) => { if (msg) notify(msg, 'error'); };
  const setSaved = (v: boolean) => { if (v) notify('Saved!'); };
  const [newPillLabel, setNewPillLabel] = useState('');
  const [newPillKeywords, setNewPillKeywords] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Pending avatar selection: previewed live, only persisted via Save Avatar.
  // Closing without saving discards it (like the background color).
  interface PendingAvatar {
    type: 'initial' | 'character' | 'upload';
    characterId: string | null;
    url: string | null; // blob preview URL, Google pic URL, or null
    file: File | null; // set when a new photo was chosen but not yet uploaded
  }
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);

  const setPending = (next: PendingAvatar | null) => {
    setPendingAvatar((prev) => {
      if (prev?.url?.startsWith('blob:')) URL.revokeObjectURL(prev.url);
      return next;
    });
  };

  // Effective avatar = pending selection if any, otherwise the saved profile
  const effAvatarUrl = pendingAvatar ? pendingAvatar.url : profile?.avatar_url;
  const effAvatarType = pendingAvatar ? pendingAvatar.type : profile?.avatar_type;
  const effAvatarCharacter = pendingAvatar ? pendingAvatar.characterId : profile?.avatar_character;
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load profile data when the dialog opens — not on every profile update,
  // so saves (Clear, theme pick, avatar) don't clobber edits or yank the tab
  const loadedForOpen = useRef(false);
  const boardsLoadedForOpen = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      loadedForOpen.current = false;
      // Discard any unsaved avatar preview (reverts like the background color)
      setPendingAvatar((prev) => {
        if (prev?.url?.startsWith('blob:')) URL.revokeObjectURL(prev.url);
        return null;
      });
      return;
    }
    if (profile && !loadedForOpen.current) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setUsernameStatus('idle');
      setBio(profile.bio || '');
      setSocials(profile.social_links || {});
      setPills(profile.pills || CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const })));
      setBgColor(profile.background_color || '');
      setBgHex(profile.background_color || '');
      setUseViewerThemeForBoards(profile.use_viewer_theme_for_boards || false);
      setTab('profile');
      setError('');
      setSaved(false);
      loadedForOpen.current = true;
    }
  }, [isOpen, profile]);

  // Sync theme from profile on load
  useEffect(() => {
    if (isOpen && profile?.theme && profile.theme !== localTheme) {
      setLocalTheme(profile.theme as any);
    }
  }, [isOpen, profile]);

  // Live-apply the picked background color to the page as it's chosen,
  // so what she sees while picking is what gets saved. Reverts to the
  // last saved color if the dialog closes without saving.
  useEffect(() => {
    if (!isOpen || tab !== 'theme') return;
    const valid = (c: string) => !!c && /^#[0-9a-fA-F]{6}$/.test(c);
    const live = valid(bgColor) ? bgColor : null;
    const saved = valid(profile?.background_color || '') ? profile?.background_color || null : null;
    const root = document.documentElement;
    if (live || saved) root.style.setProperty('--news-bg', (live || saved) as string);
    else root.style.removeProperty('--news-bg');
    return () => {
      if (saved) root.style.setProperty('--news-bg', saved);
      else root.style.removeProperty('--news-bg');
    };
  }, [isOpen, tab, bgColor, profile?.background_color]);

  // Keep the color wheel in sync with the active theme's background when
  // no custom color is picked
  useEffect(() => {
    if (!isOpen) return;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--news-bg').trim();
    setThemeBg(/^#[0-9a-fA-F]{6}$/.test(v) ? v : '');
  }, [isOpen, localTheme, bgColor, profile?.background_color]);

  // Load boards when the dialog opens
  useEffect(() => {
    if (!isOpen) {
      boardsLoadedForOpen.current = false;
      setEditingBoard(null);
      return;
    }
    if (user && !boardsLoadedForOpen.current) {
      boardsLoadedForOpen.current = true;
      loadBoards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

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
      const normalizedSocials = Object.fromEntries(
        Object.entries(socials).map(([k, v]) => [k, normalizeSocialLink(k, v || '')])
      ) as SocialLinks;
      await updateProfile({
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        social_links: normalizedSocials,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    // Preview only — the actual upload happens on Save
    setPending({ type: 'upload', characterId: null, url: URL.createObjectURL(file), file });
  };

  const handleCharacterSelect = (characterId: string) => {
    setError('');
    setPending({ type: 'character', characterId, url: null, file: null });
  };

  const handleInitialAvatar = () => {
    setError('');
    setPending({ type: 'initial', characterId: null, url: null, file: null });
  };

  // Open the user's public profile page (only possible once a username is set)
  const openPublicProfile = () => {
    if (!profile?.username) return;
    const name = profile.username;
    onClose();
    window.history.pushState({}, '', `/@${name}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const googlePicUrl = user?.user_metadata?.picture || user?.user_metadata?.avatar_url || null;

  const handleGoogleAvatar = () => {
    if (!googlePicUrl) return;
    setError('');
    setPending({ type: 'upload', characterId: null, url: googlePicUrl, file: null });
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatar) return;
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      let url = pendingAvatar.url;
      if (pendingAvatar.file) {
        url = await uploadAvatarFile(pendingAvatar.file);
      }
      await updateProfile({
        avatar_type: pendingAvatar.type,
        avatar_character: pendingAvatar.characterId,
        avatar_url: url,
      });
      if (pendingAvatar.url?.startsWith('blob:')) URL.revokeObjectURL(pendingAvatar.url);
      setPendingAvatar(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save avatar');
    } finally {
      setSaving(false);
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

  // ---- Interests (pills) ----
  const togglePill = (pillId: string) => {
    setPills((prev) => {
      const exists = prev.find((p) => p.id === pillId);
      if (exists) {
        return prev.filter((p) => p.id !== pillId);
      }
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

  const handleSaveInterests = async () => {
    setSaving(true);
    try {
      await updateProfile({ pills });
      notify('Interests saved', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- Boards ----
  const loadBoards = async () => {
    if (!user) return;
    setBoardsLoading(true);
    try {
      setBoards(await getUserBoards(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load boards');
    } finally {
      setBoardsLoading(false);
    }
  };

  const handleNewBoard = () => {
    setEditingBoard({
      id: null,
      name: '',
      slug: '',
      description: '',
      logoUrl: null,
      logoFile: null,
      theme: '',
      bgColor: '',
      pills: [...pills],
    });
  };

  const handleEditBoard = (board: Board) => {
    setEditingBoard({
      id: board.id,
      name: board.name,
      slug: board.slug,
      description: board.description || '',
      logoUrl: board.logo_url,
      logoFile: null,
      theme: board.theme || '',
      bgColor: board.background_color || '',
      pills: [...(board.pills || [])],
    });
  };

  const handleBoardLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (boardLogoRef.current) boardLogoRef.current.value = '';
    if (!file || !editingBoard) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    if (editingBoard.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingBoard.logoUrl);
    setEditingBoard({ ...editingBoard, logoUrl: URL.createObjectURL(file), logoFile: file });
  };

  const handleBoardPillToggle = (pill: PillConfig) => {
    if (!editingBoard) return;
    const exists = editingBoard.pills.some((p) => p.type === pill.type && p.id === pill.id);
    setEditingBoard({
      ...editingBoard,
      pills: exists
        ? editingBoard.pills.filter((p) => !(p.type === pill.type && p.id === pill.id))
        : [...editingBoard.pills, pill],
    });
  };

  const addCustomBoardPill = () => {
    if (!editingBoard || !newPillLabel.trim()) return;
    const id = `custom-${Date.now()}`;
    const pill: PillConfig = {
      id,
      type: 'custom',
      label: newPillLabel.trim(),
      keywords: newPillKeywords.trim() || undefined,
    };
    setEditingBoard({ ...editingBoard, pills: [...editingBoard.pills, pill] });
    setNewPillLabel('');
    setNewPillKeywords('');
  };

  const handleSaveBoard = async () => {
    if (!editingBoard || !user) return;
    const name = editingBoard.name.trim();
    if (!name) {
      setError('Give your board a name');
      return;
    }
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const slug = await ensureUniqueSlug(
        user.id,
        slugify(editingBoard.slug.trim() || name),
        editingBoard.id || undefined
      );
      let logoUrl = editingBoard.logoUrl;
      // New boards: create first (need the id for the logo path), then upload
      let boardId = editingBoard.id;
      if (!boardId) {
        const created = await createBoard(user.id, {
          name,
          slug,
          description: editingBoard.description.trim() || null,
          logo_url: null,
          theme: editingBoard.theme || null,
          background_color: editingBoard.bgColor || null,
          pills: editingBoard.pills,
          position: boards.length,
        });
        boardId = created.id;
      }
      if (editingBoard.logoFile && boardId) {
        logoUrl = await uploadBoardLogo(user.id, boardId, editingBoard.logoFile);
      }
      const updated = await updateBoard(boardId, {
        name,
        slug,
        description: editingBoard.description.trim() || null,
        logo_url: editingBoard.logoFile ? logoUrl : editingBoard.logoUrl,
        theme: editingBoard.theme || null,
        background_color: editingBoard.bgColor || null,
        pills: editingBoard.pills,
      });
      if (editingBoard.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingBoard.logoUrl);
      setBoards((prev) => {
        const exists = prev.some((b) => b.id === updated.id);
        const next = exists ? prev.map((b) => (b.id === updated.id ? updated : b)) : [...prev, updated];
        return next.sort((a, b) => a.position - b.position);
      });
      setEditingBoard(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save board');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBoard = async (boardId: string, boardName: string) => {
    if (!window.confirm(`Delete the "${boardName}" board? This can't be undone.`)) return;
    setError('');
    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      if (editingBoard?.id === boardId) setEditingBoard(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete board');
    }
  };

  const handleMoveBoard = async (boardId: string, dir: -1 | 1) => {
    const idx = boards.findIndex((b) => b.id === boardId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= boards.length) return;
    const next = [...boards];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setBoards(next);
    try {
      await reorderBoards(next.map((b) => b.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
      loadBoards();
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
    if (effAvatarUrl) {
      return <img src={effAvatarUrl} alt="Profile" className={cls} />;
    }
    if (effAvatarType === 'character' && effAvatarCharacter) {
      const char = CHARACTER_AVATARS.find((c) => c.id === effAvatarCharacter);
      if (char) {
        return (
          <div className={cls} style={{ background: char.bg, fontSize: size === 'lg' ? '2.4rem' : '1.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="avatar-emoji-glyph">{char.emoji}</span>
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
    { id: 'interests', label: 'Interests' },
    { id: 'theme', label: 'Theme' },
    { id: 'boards', label: 'Boards' },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog profile-dialog-expanded" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>

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

        {tab === 'profile' && (
          <div className="profile-tab-content">
            <div className="profile-avatar-row">
              {profile?.username ? (
                <button
                  type="button"
                  className="profile-avatar-link"
                  title="View your public profile"
                  onClick={openPublicProfile}
                >
                  {renderAvatar('lg')}
                </button>
              ) : (
                renderAvatar('lg')
              )}
              <div>
                {profile?.username ? (
                  <button
                    type="button"
                    className="profile-email profile-email-link"
                    title="View your public profile"
                    onClick={openPublicProfile}
                  >
                    {user?.email}
                  </button>
                ) : (
                  <div className="profile-email">{user?.email}</div>
                )}
                {profile?.username && (
                  <button
                    type="button"
                    className="profile-username profile-username-link"
                    title="View your public profile"
                    onClick={openPublicProfile}
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
              <div className="profile-hint profile-hint-compact">Just your username is fine — or paste the full link. Both work.</div>
              {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="social-field">
                  <span className="social-label">{label}</span>
                  <input
                    type="text"
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
                <button type="button" className="sign-in-button secondary-button" onClick={() => fileRef.current?.click()}>
                  Upload photo
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
                  className={`character-option ${effAvatarType === 'character' && effAvatarCharacter === char.id ? 'selected' : ''}`}
                  onClick={() => handleCharacterSelect(char.id)}
                  title={char.name}
                >
                  <span className="character-emoji" style={{ background: char.bg }}>
                    <span className="avatar-emoji-glyph">{char.emoji}</span>
                  </span>
                  <span className="character-name">{char.name}</span>
                </button>
              ))}
            </div>

            <div className="avatar-alt-options">
              {googlePicUrl && (
                <button type="button" className="link-button" onClick={handleGoogleAvatar}>
                  Use Google profile photo
                </button>
              )}
              <button type="button" className="link-button" onClick={handleInitialAvatar}>
                Use initial letter instead
              </button>
            </div>

            <button
              type="button"
              className="sign-in-button primary-button"
              onClick={handleSaveAvatar}
              disabled={saving || !pendingAvatar}
              style={{ marginTop: '1rem' }}
            >
              {saving ? 'Saving…' : 'Save Avatar'}
            </button>
          </div>
        )}

        {tab === 'interests' && (
          <div className="profile-tab-content">
            <p className="profile-hint">Choose your interests — they shape what appears on your homepage. Add your own custom topics too.</p>

            <label className="profile-section-label">Your interests (in order)</label>
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
              {pills.length === 0 && <p className="profile-hint">No interests selected — add some below.</p>}
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

            <label className="profile-section-label">Add a custom interest</label>
            <div className="board-custom-pill-row">
              <input
                type="text"
                className="board-input"
                value={newPillLabel}
                onChange={(e) => setNewPillLabel(e.target.value)}
                placeholder="e.g. Baking, Dinosaurs…"
                maxLength={40}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomPill();
                  }
                }}
              />
              <button
                type="button"
                className="sign-in-button secondary-button"
                onClick={addCustomPill}
                disabled={!newPillLabel.trim()}
              >
                Add
              </button>
            </div>

            <div className="board-editor-actions">
              <button
                type="button"
                className="sign-in-button primary-button"
                onClick={handleSaveInterests}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save interests'}
              </button>
            </div>
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
                value={bgColor || themeBg || '#1e293b'}
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

            <button type="button" className="sign-in-button primary-button" onClick={handleSaveTheme} disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Saving…' : 'Save Theme'}
            </button>

            <label className="profile-section-label" style={{ marginTop: '1.5rem' }}>Viewing others' boards</label>
            <label className="board-pill-option" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useViewerThemeForBoards}
                onChange={(e) => {
                  const next = e.target.checked;
                  setUseViewerThemeForBoards(next);
                  // Save immediately
                  updateProfile({ use_viewer_theme_for_boards: next })
                    .then(() => notify('Preference saved', 'success'))
                    .catch((err) => notify(err instanceof Error ? err.message : 'Failed to save', 'error'));
                }}
              />
              <span>Always use my theme when viewing others' boards</span>
            </label>
            <p className="profile-hint profile-hint-compact">
              Off by default. When on, boards you visit will appear in your theme instead of the owner's.
            </p>
          </div>
        )}

        {tab === 'boards' && (
          <div className="profile-tab-content">
            {!editingBoard ? (
              <>
                <label className="profile-section-label">Your boards</label>
                <p className="profile-hint profile-hint-compact">
                  Boards group your topics into their own pages at @{profile?.username || 'you'}/board-name.
                </p>
                {boardsLoading ? (
                  <p className="profile-hint">Loading boards…</p>
                ) : boards.length === 0 ? (
                  <p className="profile-hint">No boards yet — create your first one below.</p>
                ) : (
                  <div className="board-list">
                    {boards.map((board, i) => (
                      <div key={board.id} className="board-row">
                        {board.logo_url ? (
                          <img src={board.logo_url} alt="" className="board-row-logo" />
                        ) : (
                          <span className="board-row-logo-fallback">
                            {(board.name || '?')[0].toUpperCase()}
                          </span>
                        )}
                        <div className="board-row-info">
                          <div className="board-row-name">{board.name}</div>
                          <div className="board-row-slug">@{profile?.username}/{board.slug}</div>
                        </div>
                        <div className="board-row-actions">
                          <button
                            type="button"
                            className="board-icon-button"
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => handleMoveBoard(board.id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="board-icon-button"
                            title="Move down"
                            disabled={i === boards.length - 1}
                            onClick={() => handleMoveBoard(board.id, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="board-icon-button"
                            title="Edit board"
                            onClick={() => handleEditBoard(board)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="board-icon-button board-delete"
                            title="Delete board"
                            onClick={() => handleDeleteBoard(board.id, board.name)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="sign-in-button primary-button"
                  onClick={handleNewBoard}
                  style={{ marginTop: '1rem' }}
                >
                  + New board
                </button>
              </>
            ) : (
              <>
                <button type="button" className="link-button" onClick={() => setEditingBoard(null)}>
                  ← Back to boards
                </button>
                <label className="profile-section-label">
                  {editingBoard.id ? 'Edit board' : 'New board'}
                </label>

                <label className="profile-field-label">Name</label>
                <input
                  type="text"
                  className="board-input"
                  value={editingBoard.name}
                  onChange={(e) => setEditingBoard({ ...editingBoard, name: e.target.value })}
                  placeholder="Cozy reads"
                  maxLength={60}
                />

                <label className="profile-field-label">URL</label>
                <div className="board-slug-row">
                  <span className="board-slug-prefix">@{profile?.username}/</span>
                  <input
                    type="text"
                    className="board-input board-slug-input"
                    value={editingBoard.slug}
                    onChange={(e) => setEditingBoard({ ...editingBoard, slug: slugify(e.target.value) })}
                    placeholder={slugify(editingBoard.name) || 'board-name'}
                    maxLength={50}
                  />
                </div>

                <label className="profile-field-label">Description (optional)</label>
                <textarea
                  className="board-input board-description-input"
                  value={editingBoard.description}
                  onChange={(e) => setEditingBoard({ ...editingBoard, description: e.target.value })}
                  placeholder="What is this board about?"
                  maxLength={280}
                  rows={2}
                />

                <label className="profile-field-label">Board logo (optional)</label>
                <div className="board-logo-row">
                  {editingBoard.logoUrl ? (
                    <img src={editingBoard.logoUrl} alt="Board logo preview" className="board-logo-preview" />
                  ) : (
                    <span className="board-row-logo-fallback board-logo-preview">
                      {(editingBoard.name || '?')[0].toUpperCase()}
                    </span>
                  )}
                  <div>
                    <input
                      ref={boardLogoRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleBoardLogoPick}
                    />
                    <button
                      type="button"
                      className="sign-in-button secondary-button"
                      onClick={() => boardLogoRef.current?.click()}
                    >
                      {editingBoard.logoUrl && !editingBoard.logoUrl.startsWith('blob:') ? 'Change logo' : 'Upload logo'}
                    </button>
                    {(editingBoard.logoUrl || editingBoard.logoFile) && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          if (editingBoard.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingBoard.logoUrl);
                          setEditingBoard({ ...editingBoard, logoUrl: null, logoFile: null });
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <label className="profile-field-label">Theme</label>
                <div className="board-theme-row">
                  <button
                    type="button"
                    className={`theme-option ${editingBoard.theme === '' ? 'selected' : ''}`}
                    onClick={() => setEditingBoard({ ...editingBoard, theme: '' })}
                  >
                    <span className="theme-name">Use profile theme</span>
                  </button>
                  {THEMES.map((themeOption) => (
                    <button
                      key={themeOption.id}
                      type="button"
                      className={`theme-option ${editingBoard.theme === themeOption.id ? 'selected' : ''}`}
                      onClick={() => setEditingBoard({ ...editingBoard, theme: themeOption.id })}
                    >
                      <span className="theme-icon">{themeOption.icon}</span>
                      <span className="theme-name">{themeOption.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`theme-option ${editingBoard.theme === 'none' ? 'selected' : ''}`}
                    onClick={() => setEditingBoard({ ...editingBoard, theme: 'none' })}
                  >
                    <span className="theme-name">No theme</span>
                  </button>
                </div>

                <label className="profile-field-label">Background color (optional)</label>
                <div className="color-picker-row">
                  <input
                    type="color"
                    value={editingBoard.bgColor || themeBg || '#1e293b'}
                    onChange={(e) => setEditingBoard({ ...editingBoard, bgColor: e.target.value })}
                    className="color-wheel"
                    aria-label="Pick board background color"
                  />
                  <input
                    type="text"
                    value={editingBoard.bgColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        setEditingBoard({ ...editingBoard, bgColor: v });
                      }
                    }}
                    placeholder="Inherit"
                    maxLength={7}
                    className="hex-input"
                    aria-label="Hex color code"
                  />
                  {editingBoard.bgColor && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setEditingBoard(editingBoard ? { ...editingBoard, bgColor: '' } : editingBoard)}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <label className="profile-field-label">Interests on this board</label>
                <p className="profile-hint profile-hint-compact">
                  Pick categories or add your own custom topics.
                </p>
                <div className="board-pill-picker">
                  {CATEGORIES.map((cat) => {
                    const pill: PillConfig = { id: cat.id, type: 'category' };
                    const checked = editingBoard.pills.some(
                      (p) => p.type === 'category' && p.id === cat.id
                    );
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`pill-toggle ${checked ? 'active' : ''}`}
                        onClick={() => handleBoardPillToggle(pill)}
                      >
                        <span>{cat.icon}</span> {t(cat.i18nKey as keyof TranslationStrings) || cat.id}
                      </button>
                    );
                  })}
                </div>
                <label className="profile-field-label" style={{ marginTop: '0.75rem' }}>Keyword interests</label>
                <p className="profile-hint profile-hint-compact">
                  Cross-cutting topics for custom boards — never shown as categories.
                </p>
                {INTEREST_KEYWORD_GROUPS.map((group) => (
                  <div key={group} style={{ marginBottom: '0.5rem' }}>
                    <div className="profile-hint profile-hint-compact" style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      {group}
                    </div>
                    <div className="board-pill-picker">
                      {INTEREST_KEYWORDS.filter((kw) => kw.group === group).map((kw) => {
                        const pill: PillConfig = { id: kw.id, type: 'keyword' };
                        const checked = editingBoard.pills.some(
                          (p) => p.type === 'keyword' && p.id === kw.id
                        );
                        return (
                          <button
                            key={kw.id}
                            type="button"
                            className={`pill-toggle ${checked ? 'active' : ''}`}
                            onClick={() => handleBoardPillToggle(pill)}
                          >
                            <span>{kw.icon}</span> {kw.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {editingBoard.pills.filter((p) => p.type === 'custom').length > 0 && (
                  <div className="board-custom-pills">
                    {editingBoard.pills
                      .filter((p) => p.type === 'custom')
                      .map((pill) => (
                        <span key={pill.id} className="board-custom-pill">
                          📌 {pill.label || pill.id}
                          <button
                            type="button"
                            className="pill-remove"
                            onClick={() => handleBoardPillToggle(pill)}
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
                <div className="board-custom-pill-row">
                  <input
                    type="text"
                    className="board-input"
                    value={newPillLabel}
                    onChange={(e) => setNewPillLabel(e.target.value)}
                    placeholder="Add a custom topic…"
                    maxLength={40}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomBoardPill();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="sign-in-button secondary-button"
                    onClick={addCustomBoardPill}
                    disabled={!newPillLabel.trim()}
                  >
                    Add
                  </button>
                </div>

                <div className="board-editor-actions">
                  <button
                    type="button"
                    className="sign-in-button primary-button"
                    onClick={handleSaveBoard}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : editingBoard.id ? 'Save board' : 'Create board'}
                  </button>
                  {editingBoard.id && (
                    <button
                      type="button"
                      className="sign-in-button secondary-button board-delete-button"
                      onClick={() => handleDeleteBoard(editingBoard.id as string, editingBoard.name)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
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
