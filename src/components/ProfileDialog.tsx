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
import {
  Playroom,
  getUserPlayrooms,
  getPlayroomSpaces,
  createPlayroom,
  updatePlayroom,
  ensureUniquePlayroomSlug,
  addSpaceToPlayroom,
  removeSpaceFromPlayroom,
  uploadPlayroomLogo,
} from '../services/playroomService';
import { t } from '../constants/translations';
import { TranslationStrings } from '../constants/translations';
import { useTheme } from '../hooks/useTheme';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notify: (message: string, kind?: 'success' | 'error') => void;
}

type Tab = 'profile' | 'avatar' | 'interests' | 'theme' | 'boards';

/** Max spaces (boards) a user can create. */
const MAX_SPACES = 5;
/** Max spaces a playroom can hold on the free tier. */
const MAX_PLAYROOM_SPACES = 5;

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
  // Playrooms (free tier: one per user)
  const [playrooms, setPlayrooms] = useState<Playroom[]>([]);
  const [playroomSpaces, setPlayroomSpaces] = useState<Board[]>([]);
  const [playroomsLoading, setPlayroomsLoading] = useState(false);
  const [showAddSpacePicker, setShowAddSpacePicker] = useState(false);
  interface EditingPlayroom {
    id: string;
    name: string;
    slug: string;
    description: string;
    logoUrl: string | null; // existing URL or blob preview
    logoFile: File | null;
    theme: string; // '' = inherit profile theme
    bgColor: string; // '' = inherit
  }
  const [editingPlayroom, setEditingPlayroom] = useState<EditingPlayroom | null>(null);
  const playroomLogoRef = useRef<HTMLInputElement>(null);
  interface EditingBoard {
    id: string | null; // null = new board
    name: string;
    slug: string;
    description: string;
    logoUrl: string | null; // existing URL or blob preview
    logoFile: File | null;
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

  // Load boards + playrooms when the dialog opens
  useEffect(() => {
    if (!isOpen) {
      boardsLoadedForOpen.current = false;
      setEditingBoard(null);
      setEditingPlayroom(null);
      setShowAddSpacePicker(false);
      return;
    }
    if (user && !boardsLoadedForOpen.current) {
      boardsLoadedForOpen.current = true;
      loadBoards();
      loadPlayrooms();
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
        ...prev.filter((p) => p.type !== 'category'),
      ];
      const ordered = allPills.filter((p) => prev.some((pp) => pp.id === p.id) || p.id === pillId);
      return ordered;
    });
  };

  /** Snapshot a board's topics as match keywords for a board interest pill. */
  const boardInterestKeywords = (board: Board): string => {
    const terms: string[] = [];
    for (const p of board.pills || []) {
      if (p.type === 'category' || p.type === 'keyword') terms.push(p.id);
      else if (p.type === 'custom') {
        if (p.keywords) terms.push(p.keywords);
        if (p.label) terms.push(p.label);
      }
    }
    return terms.join(', ');
  };

  /** Toggle one of the user's boards as an interest (boosts matching stories on the homepage). */
  const toggleBoardPill = (board: Board) => {
    const pillId = `board-${board.id}`;
    setPills((prev) => {
      if (prev.some((p) => p.id === pillId)) {
        return prev.filter((p) => p.id !== pillId);
      }
      const keywords = boardInterestKeywords(board);
      return [...prev, { id: pillId, type: 'board' as const, label: board.name, keywords: keywords || undefined }];
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
    if (boards.length >= MAX_SPACES) return;
    setEditingBoard({
      id: null,
      name: '',
      slug: '',
      description: '',
      logoUrl: null,
      logoFile: null,
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
      // Spaces are interest-defined feeds: theme/background live on the playroom, not the space.
      let boardId = editingBoard.id;
      if (!boardId) {
        const created = await createBoard(user.id, {
          name,
          slug,
          description: editingBoard.description.trim() || null,
          logo_url: null,
          theme: null,
          background_color: null,
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
        theme: null,
        background_color: null,
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
    if (!window.confirm(`Delete the "${boardName}" space? This can't be undone.`)) return;
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

  // ---- Playrooms ----
  const loadPlayrooms = async () => {
    if (!user) return;
    setPlayroomsLoading(true);
    try {
      let rooms = await getUserPlayrooms(user.id);
      // Free tier gets one playroom; self-heal if missing (e.g. signed up after the backfill)
      if (rooms.length === 0) {
        const created = await createPlayroom(user.id, {
          name: 'My playroom',
          slug: 'my-playroom',
          description: null,
          logo_url: null,
          theme: null,
          background_color: null,
          position: 0,
        });
        rooms = [created];
      }
      setPlayrooms(rooms);
      setPlayroomSpaces(await getPlayroomSpaces(rooms[0].id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playrooms');
    } finally {
      setPlayroomsLoading(false);
    }
  };

  const handleEditPlayroom = (playroom: Playroom) => {
    setEditingPlayroom({
      id: playroom.id,
      name: playroom.name,
      slug: playroom.slug,
      description: playroom.description || '',
      logoUrl: playroom.logo_url,
      logoFile: null,
      theme: playroom.theme || '',
      bgColor: playroom.background_color || '',
    });
  };

  const handlePlayroomLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (playroomLogoRef.current) playroomLogoRef.current.value = '';
    if (!file || !editingPlayroom) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    if (editingPlayroom.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingPlayroom.logoUrl);
    setEditingPlayroom({ ...editingPlayroom, logoUrl: URL.createObjectURL(file), logoFile: file });
  };

  const handleSavePlayroom = async () => {
    if (!editingPlayroom || !user) return;
    const name = editingPlayroom.name.trim();
    if (!name) {
      setError('Give your playroom a name');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const slug = await ensureUniquePlayroomSlug(
        user.id,
        slugify(editingPlayroom.slug.trim() || name),
        editingPlayroom.id
      );
      let logoUrl = editingPlayroom.logoUrl;
      if (editingPlayroom.logoFile) {
        logoUrl = await uploadPlayroomLogo(user.id, editingPlayroom.id, editingPlayroom.logoFile);
      }
      const updated = await updatePlayroom(editingPlayroom.id, {
        name,
        slug,
        description: editingPlayroom.description.trim() || null,
        logo_url: editingPlayroom.logoFile ? logoUrl : editingPlayroom.logoUrl,
        theme: editingPlayroom.theme || null,
        background_color: editingPlayroom.bgColor || null,
      });
      if (editingPlayroom.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingPlayroom.logoUrl);
      setPlayrooms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPlayroom(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save playroom');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSpaceToPlayroom = async (boardId: string) => {
    const playroom = playrooms[0];
    if (!playroom) return;
    if (playroomSpaces.length >= MAX_PLAYROOM_SPACES) {
      setError(`A playroom can hold at most ${MAX_PLAYROOM_SPACES} spaces`);
      return;
    }
    setError('');
    try {
      await addSpaceToPlayroom(playroom.id, boardId);
      setPlayroomSpaces(await getPlayroomSpaces(playroom.id));
      setShowAddSpacePicker(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add space');
    }
  };

  const handleRemoveSpaceFromPlayroom = async (boardId: string, boardName: string) => {
    const playroom = playrooms[0];
    if (!playroom) return;
    if (!window.confirm(`Remove "${boardName}" from this playroom? The space itself is kept.`)) return;
    setError('');
    try {
      await removeSpaceFromPlayroom(playroom.id, boardId);
      setPlayroomSpaces((prev) => prev.filter((b) => b.id !== boardId));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove space');
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
    { id: 'boards', label: 'Playrooms' },
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

              <label htmlFor="profile-username">Unique link</label>
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
            <p className="profile-hint">Choose your interests — they shape what appears on your playroom.</p>

            <label className="profile-section-label">Your interests (in order)</label>
            <div className="pill-list">
              {pills.map((pill, index) => {
                const cat = CATEGORIES.find((c) => c.id === pill.id);
                const board = pill.type === 'board' ? boards.find((b) => `board-${b.id}` === pill.id) : undefined;
                const label = pill.type === 'custom' || pill.type === 'board'
                  ? (pill.label || pill.id)
                  : (cat ? t(cat.i18nKey as keyof TranslationStrings) || cat.id : pill.id);
                const icon = pill.type === 'custom' ? '📌' : (cat?.icon || '');
                return (
                  <div key={pill.id} className="pill-row">
                    <span className="pill-icon">
                      {board?.logo_url ? (
                        <img src={board.logo_url} alt="" className="pill-board-logo" />
                      ) : board ? (
                        (board.name || '?')[0].toUpperCase()
                      ) : (
                        icon
                      )}
                    </span>
                    <span className="pill-label">{label}</span>
                    {(pill.type === 'custom' || pill.type === 'board') && (
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

            <label className="profile-section-label">Available spaces</label>
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

            {boards.length > 0 && (
              <>
                <label className="profile-section-label">Your spaces</label>
                <div className="pill-toggle-grid">
                  {boards.map((board) => {
                    const pillId = `board-${board.id}`;
                    const active = pills.some((p) => p.id === pillId);
                    return (
                      <button
                        key={pillId}
                        type="button"
                        className={`pill-toggle ${active ? 'active' : ''}`}
                        onClick={() => toggleBoardPill(board)}
                      >
                        {board.logo_url ? (
                          <img src={board.logo_url} alt="" className="pill-toggle-logo" />
                        ) : (
                          <span>{(board.name || '?')[0].toUpperCase()}</span>
                        )}{' '}
                        {board.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

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

            <label className="profile-section-label" style={{ marginTop: '1.5rem' }}>Viewing others' spaces</label>
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
              <span>Always use my theme when viewing others' spaces</span>
            </label>
            <p className="profile-hint profile-hint-compact">
              Off by default. When on, boards you visit will appear in your theme instead of the owner's.
            </p>
          </div>
        )}

        {tab === 'boards' && (
          <div className="profile-tab-content">
            {/* Playroom section (hidden while editing a space) */}
            {!editingBoard && (
              <>
                <label className="profile-section-label">🛝 Your playroom</label>
                <p className="profile-hint profile-hint-compact">
                  Your shareable homepage — a collection of your spaces at @{profile?.username || 'you'}/{playrooms[0]?.slug || 'my-playroom'}.
                </p>
                {playroomsLoading ? (
                  <p className="profile-hint">Loading playroom…</p>
                ) : editingPlayroom ? (
                  <>
                    <label className="profile-field-label">Name</label>
                    <input
                      type="text"
                      className="board-input"
                      value={editingPlayroom.name}
                      onChange={(e) => setEditingPlayroom({ ...editingPlayroom, name: e.target.value })}
                      placeholder="My playroom"
                      maxLength={60}
                    />

                    <label className="profile-field-label">URL</label>
                    <div className="board-slug-row">
                      <span className="board-slug-prefix">@{profile?.username}/</span>
                      <input
                        type="text"
                        className="board-input board-slug-input"
                        value={editingPlayroom.slug}
                        onChange={(e) => setEditingPlayroom({ ...editingPlayroom, slug: slugify(e.target.value) })}
                        placeholder={slugify(editingPlayroom.name) || 'my-playroom'}
                        maxLength={50}
                      />
                    </div>

                    <label className="profile-field-label">Description (optional)</label>
                    <textarea
                      className="board-input board-description-input"
                      value={editingPlayroom.description}
                      onChange={(e) => setEditingPlayroom({ ...editingPlayroom, description: e.target.value })}
                      placeholder="What is this playroom about?"
                      maxLength={280}
                      rows={2}
                    />

                    <label className="profile-field-label">Playroom logo (optional)</label>
                    <div className="board-logo-row">
                      {editingPlayroom.logoUrl ? (
                        <img src={editingPlayroom.logoUrl} alt="Playroom logo preview" className="board-logo-preview" />
                      ) : (
                        <span className="board-row-logo-fallback board-logo-preview">
                          {(editingPlayroom.name || '?')[0].toUpperCase()}
                        </span>
                      )}
                      <div>
                        <input
                          ref={playroomLogoRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handlePlayroomLogoPick}
                        />
                        <button
                          type="button"
                          className="sign-in-button secondary-button"
                          onClick={() => playroomLogoRef.current?.click()}
                        >
                          {editingPlayroom.logoUrl && !editingPlayroom.logoUrl.startsWith('blob:') ? 'Change logo' : 'Upload logo'}
                        </button>
                        {(editingPlayroom.logoUrl || editingPlayroom.logoFile) && (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              if (editingPlayroom.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingPlayroom.logoUrl);
                              setEditingPlayroom({ ...editingPlayroom, logoUrl: null, logoFile: null });
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
                        className={`theme-option ${editingPlayroom.theme === '' ? 'selected' : ''}`}
                        onClick={() => setEditingPlayroom({ ...editingPlayroom, theme: '' })}
                      >
                        <span className="theme-name">Use profile theme</span>
                      </button>
                      {THEMES.map((themeOption) => (
                        <button
                          key={themeOption.id}
                          type="button"
                          className={`theme-option ${editingPlayroom.theme === themeOption.id ? 'selected' : ''}`}
                          onClick={() => setEditingPlayroom({ ...editingPlayroom, theme: themeOption.id })}
                        >
                          <span className="theme-icon">{themeOption.icon}</span>
                          <span className="theme-name">{themeOption.name}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`theme-option ${editingPlayroom.theme === 'none' ? 'selected' : ''}`}
                        onClick={() => setEditingPlayroom({ ...editingPlayroom, theme: 'none' })}
                      >
                        <span className="theme-name">No theme</span>
                      </button>
                    </div>

                    <label className="profile-field-label">Background color (optional)</label>
                    <div className="color-picker-row">
                      <input
                        type="color"
                        value={editingPlayroom.bgColor || themeBg || '#1e293b'}
                        onChange={(e) => setEditingPlayroom({ ...editingPlayroom, bgColor: e.target.value })}
                        className="color-wheel"
                        aria-label="Pick playroom background color"
                      />
                      <input
                        type="text"
                        value={editingPlayroom.bgColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                            setEditingPlayroom({ ...editingPlayroom, bgColor: v });
                          }
                        }}
                        placeholder="Inherit"
                        maxLength={7}
                        className="hex-input"
                        aria-label="Hex color code"
                      />
                      {editingPlayroom.bgColor && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setEditingPlayroom(editingPlayroom ? { ...editingPlayroom, bgColor: '' } : editingPlayroom)}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="board-editor-actions">
                      <button
                        type="button"
                        className="sign-in-button secondary-button"
                        onClick={() => setEditingPlayroom(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="sign-in-button primary-button"
                        onClick={handleSavePlayroom}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save playroom'}
                      </button>
                    </div>
                  </>
                ) : playrooms[0] ? (
                  <>
                    <div className="board-list">
                      <div className="board-row">
                        {playrooms[0].logo_url ? (
                          <img src={playrooms[0].logo_url} alt="" className="board-row-logo" />
                        ) : (
                          <span className="board-row-logo-fallback">
                            {(playrooms[0].name || '?')[0].toUpperCase()}
                          </span>
                        )}
                        <div className="board-row-info">
                          <div className="board-row-name">🛝 {playrooms[0].name}</div>
                          <div className="board-row-slug">@{profile?.username}/{playrooms[0].slug}</div>
                        </div>
                        <div className="board-row-actions">
                          <button
                            type="button"
                            className="board-icon-button"
                            title="Edit playroom"
                            onClick={() => handleEditPlayroom(playrooms[0])}
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>

                    <label className="profile-field-label" style={{ marginTop: '1rem' }}>
                      Spaces in this playroom ({playroomSpaces.length} of {MAX_PLAYROOM_SPACES})
                    </label>
                    {playroomSpaces.length === 0 ? (
                      <p className="profile-hint profile-hint-compact">
                        No spaces yet — add your spaces below to build the feed.
                      </p>
                    ) : (
                      <div className="board-list">
                        {playroomSpaces.map((space) => (
                          <div key={space.id} className="board-row">
                            {space.logo_url ? (
                              <img src={space.logo_url} alt="" className="board-row-logo" />
                            ) : (
                              <span className="board-row-logo-fallback">
                                {(space.name || '?')[0].toUpperCase()}
                              </span>
                            )}
                            <div className="board-row-info">
                              <div className="board-row-name">{space.name}</div>
                              <div className="board-row-slug">@{profile?.username}/{playrooms[0].slug}/{space.slug}</div>
                            </div>
                            <div className="board-row-actions">
                              <button
                                type="button"
                                className="board-icon-button board-delete"
                                title="Remove from playroom"
                                onClick={() => handleRemoveSpaceFromPlayroom(space.id, space.name)}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showAddSpacePicker ? (
                      <div className="playroom-add-space-picker">
                        {boards.filter((b) => !playroomSpaces.some((s) => s.id === b.id)).length === 0 ? (
                          <p className="profile-hint profile-hint-compact">
                            All your spaces are already in this playroom.
                          </p>
                        ) : (
                          boards
                            .filter((b) => !playroomSpaces.some((s) => s.id === b.id))
                            .map((b) => (
                              <div key={b.id} className="board-row">
                                <div className="board-row-info">
                                  <div className="board-row-name">{b.name}</div>
                                </div>
                                <div className="board-row-actions">
                                  <button
                                    type="button"
                                    className="sign-in-button secondary-button"
                                    onClick={() => handleAddSpaceToPlayroom(b.id)}
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setShowAddSpacePicker(false)}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="sign-in-button secondary-button"
                        onClick={() => setShowAddSpacePicker(true)}
                        disabled={playroomSpaces.length >= MAX_PLAYROOM_SPACES}
                        style={{ marginTop: '0.5rem' }}
                      >
                        + Add space
                      </button>
                    )}
                  </>
                ) : null}
              </>
            )}
            {!editingBoard ? (
              <>
                <label className="profile-section-label">Your spaces</label>
                <p className="profile-hint profile-hint-compact">
                  Spaces group your topics into their own pages at @{profile?.username || 'you'}/spaces/space-name.
                </p>
                {!boardsLoading && (
                  <p className="profile-hint profile-hint-compact">
                    {boards.length >= MAX_SPACES
                      ? `You've used all ${MAX_SPACES} spaces.`
                      : `${MAX_SPACES - boards.length} of ${MAX_SPACES} spaces remaining.`}
                  </p>
                )}
                {boardsLoading ? (
                  <p className="profile-hint">Loading spaces…</p>
                ) : boards.length === 0 ? (
                  <p className="profile-hint">No spaces yet — create your first one below.</p>
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
                          <div className="board-row-slug">@{profile?.username}/spaces/{board.slug}</div>
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
                            title="Edit space"
                            onClick={() => handleEditBoard(board)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="board-icon-button board-delete"
                            title="Delete space"
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
                  disabled={boards.length >= MAX_SPACES}
                  style={{ marginTop: '1rem' }}
                >
                  + New space
                </button>
              </>
            ) : (
              <>
                <button type="button" className="link-button" onClick={() => setEditingBoard(null)}>
                  ← Back to spaces
                </button>
                <label className="profile-section-label">
                  {editingBoard.id ? 'Edit space' : 'New space'}
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
                    placeholder={slugify(editingBoard.name) || 'space-name'}
                    maxLength={50}
                  />
                </div>

                <label className="profile-field-label">Description (optional)</label>
                <textarea
                  className="board-input board-description-input"
                  value={editingBoard.description}
                  onChange={(e) => setEditingBoard({ ...editingBoard, description: e.target.value })}
                  placeholder="What is this space about?"
                  maxLength={280}
                  rows={2}
                />

                <label className="profile-field-label">Space logo (optional)</label>
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

                <label className="profile-field-label">Interests in this space</label>
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
                {INTEREST_KEYWORD_GROUPS.map((group: string) => (
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
                    {saving ? 'Saving…' : editingBoard.id ? 'Save space' : 'Create space'}
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
