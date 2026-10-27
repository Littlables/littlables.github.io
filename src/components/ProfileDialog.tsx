import { useState, useEffect, useRef } from 'react';
import { useAuth, Profile, PillConfig, SocialLinks, getMembershipLimits } from '../contexts/AuthContext';
import { CHARACTER_AVATARS } from '../constants/avatars';
import { THEMES, CATEGORIES } from '../constants/config';
import { INTEREST_KEYWORDS, INTEREST_KEYWORD_GROUPS } from '../constants/interestKeywords';
import {
  Space,
  slugify,
  sanitizeSlugInput,
  ensureUniqueSlug,
  getUserSpaces,
  createSpace,
  updateSpace,
  deleteSpace,
  reorderSpaces,
  uploadSpaceLogo,
} from '../services/spaceService';
import {
  Playroom,
  getUserPlayrooms,
  getPlayroomSpaces,
  createPlayroom,
  updatePlayroom,
  deletePlayroom,
  reorderPlayrooms,
  ensureUniquePlayroomSlug,
  addSpaceToPlayroom,
  removeSpaceFromPlayroom,
  reorderPlayroomSpaces,
  uploadPlayroomLogo,
} from '../services/playroomService';
import { t } from '../constants/translations';
import { TranslationStrings } from '../constants/translations';
import { useTheme } from '../hooks/useTheme';
import { useSystemFont } from '../hooks/useSystemFont';
import {
  getSpaceEmoji,
  getAutoSpaceEmoji,
  getRankedSpaceEmojis,
  getPillEmoji,
  getClosestEmojiForText,
  fetchWorkerSpaceEmojiMatches,
  getEmojiPickerGroups,
  extractSingleEmoji,
  hasNonEmojiCharacters,
  type EmojiMatch,
} from '../services/spaceEmojiService';

export type ProfileDialogTab = 'profile' | 'avatar' | 'interests' | 'theme' | 'playrooms' | 'spaces';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notify: (message: string, kind?: 'success' | 'error') => void;
  initialTab?: ProfileDialogTab;
  initialEditPlayroomId?: string | null;
  initialEditPlayroom?: Playroom | null;
  initialEditPlayroomSpaces?: Space[] | null;
  initialEditSpaceId?: string | null;
  initialEditSpace?: Space | null;
}

type Tab = 'profile' | 'avatar' | 'interests' | 'theme' | 'playrooms';

function normalizeTab(tab?: ProfileDialogTab): Tab {
  if (!tab) return 'profile';
  if (tab === 'spaces') return 'playrooms';
  return tab;
}

interface EditingPlayroom {
  id: string | null; // null = new playroom
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null; // existing URL or blob preview
  logoFile: File | null;
  theme: string; // '' = inherit profile theme
  bgColor: string; // '' = inherit
}

interface EditingSpace {
  id: string | null; // null = new space
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null; // existing URL or blob preview
  logoFile: File | null;
  iconEmoji: string | null; // null = use closest embedding emoji; string = user override
  pills: PillConfig[];
}

function toEditingPlayroom(playroom: Playroom): EditingPlayroom {
  return {
    id: playroom.id,
    name: playroom.name,
    slug: playroom.slug,
    description: playroom.description || '',
    logoUrl: playroom.logo_url,
    logoFile: null,
    theme: playroom.theme || '',
    bgColor: playroom.background_color || '',
  };
}

function toEditingSpace(space: Space): EditingSpace {
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description || '',
    logoUrl: space.logo_url,
    logoFile: null,
    iconEmoji: extractSingleEmoji(space.icon_emoji) || null,
    pills: [...(space.pills || [])],
  };
}

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: 'twitter', label: 'X / Twitter', placeholder: '@handle' },
  { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@handle' },
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

export function ProfileDialog({
  isOpen,
  onClose,
  notify,
  initialTab,
  initialEditPlayroomId,
  initialEditPlayroom,
  initialEditPlayroomSpaces,
  initialEditSpaceId,
  initialEditSpace,
}: ProfileDialogProps) {
  const { user, profile, updateProfile, uploadAvatarFile, checkUsernameAvailable, signOut } = useAuth();
  const {
    maxSpaces: MAX_SPACES,
    maxPlayrooms: MAX_PLAYROOMS,
    maxPlayroomSpaces: MAX_PLAYROOM_SPACES,
  } = getMembershipLimits(profile?.membership);
  const isFreeMembership = !profile?.membership || profile.membership === 'free';
  const { theme: localTheme, setTheme: setLocalTheme } = useTheme();
  const { systemFont, setSystemFont } = useSystemFont();

  const [wasOpen, setWasOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(() => normalizeTab(initialTab));
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<SocialLinks>({});
  const [pills, setPills] = useState<PillConfig[]>([]);
  // Spaces & Playrooms (cached across opens so reopening is instant)
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [playrooms, setPlayrooms] = useState<Playroom[]>([]);
  const [playroomSpaces, setPlayroomSpaces] = useState<Space[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const collectionsLoadedForUserRef = useRef<string | null>(null);
  const [showAddSpacePicker, setShowAddSpacePicker] = useState(false);
  const [confirmRemoveSpaceId, setConfirmRemoveSpaceId] = useState<string | null>(null);
  const [confirmDeleteSpaceId, setConfirmDeleteSpaceId] = useState<string | null>(null);
  const [confirmDeletePlayroomId, setConfirmDeletePlayroomId] = useState<string | null>(null);
  const [editingPlayroom, setEditingPlayroom] = useState<EditingPlayroom | null>(null);
  const playroomLogoRef = useRef<HTMLInputElement>(null);
  const [editingSpace, setEditingSpace] = useState<EditingSpace | null>(null);
  const spaceLogoRef = useRef<HTMLInputElement>(null);
  const [showSpaceEmojiPicker, setShowSpaceEmojiPicker] = useState(false);
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [customEmojiRejected, setCustomEmojiRejected] = useState(false);
  const [workerEmojiMatches, setWorkerEmojiMatches] = useState<EmojiMatch[] | null>(null);
  const [bgColor, setBgColor] = useState('');
  const [bgHex, setBgHex] = useState('');
  // The active theme's background color, so the wheel reflects the current
  // theme when no custom color is picked
  const [themeBg, setThemeBg] = useState('');
  const [useViewerThemeForSpaces, setUseViewerThemeForSpaces] = useState(false);
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

  // Synchronously initialize tab, profile fields, and target playroom/space editor
  // on the exact render where `isOpen` becomes true so Frame 1 never flashes the
  // wrong tab or an unpopulated list.
  const loadedProfileOnOpenRef = useRef(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setTab(normalizeTab(initialTab));
    setShowAddSpacePicker(false);
    setConfirmRemoveSpaceId(null);
    setConfirmDeleteSpaceId(null);
    setConfirmDeletePlayroomId(null);
    if (profile) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setUsernameStatus('idle');
      setBio(profile.bio || '');
      setSocials(profile.social_links || {});
      setPills(profile.pills || CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const })));
      setBgColor(profile.background_color || '');
      setBgHex(profile.background_color || '');
      setUseViewerThemeForSpaces(profile.use_viewer_theme_for_boards || false);
      loadedProfileOnOpenRef.current = true;
    } else {
      loadedProfileOnOpenRef.current = false;
    }

    const targetPlayroom =
      initialEditPlayroom ||
      (initialEditPlayroomId ? playrooms.find((p) => p.id === initialEditPlayroomId) || null : null);
    setEditingPlayroom(targetPlayroom ? toEditingPlayroom(targetPlayroom) : null);
    if (initialEditPlayroom && !playrooms.some((p) => p.id === initialEditPlayroom.id)) {
      setPlayrooms((prev) => (prev.length > 0 ? prev : [initialEditPlayroom]));
    }
    if (initialEditPlayroomSpaces) {
      setPlayroomSpaces(initialEditPlayroomSpaces);
    }

    const targetSpace =
      initialEditSpace ||
      (initialEditSpaceId ? spaces.find((s) => s.id === initialEditSpaceId) || null : null);
    setEditingSpace(targetSpace ? toEditingSpace(targetSpace) : null);
    if (initialEditSpace && !spaces.some((s) => s.id === initialEditSpace.id)) {
      setSpaces((prev) => (prev.length > 0 ? prev : [initialEditSpace]));
    }
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
    setEditingSpace(null);
    setEditingPlayroom(null);
    setShowAddSpacePicker(false);
    setShowSpaceEmojiPicker(false);
    setEmojiSearchQuery('');
    setCustomEmojiInput('');
    setWorkerEmojiMatches(null);
    setConfirmRemoveSpaceId(null);
    setConfirmDeleteSpaceId(null);
    setConfirmDeletePlayroomId(null);
    loadedProfileOnOpenRef.current = false;
  }

  // If `profile` finishes loading while the dialog is already open, populate fields once
  useEffect(() => {
    if (!isOpen) {
      setPendingAvatar((prev) => {
        if (prev?.url?.startsWith('blob:')) URL.revokeObjectURL(prev.url);
        return null;
      });
      return;
    }
    if (profile && !loadedProfileOnOpenRef.current) {
      setDisplayName(profile.display_name || '');
      setUsername(profile.username || '');
      setUsernameStatus('idle');
      setBio(profile.bio || '');
      setSocials(profile.social_links || {});
      setPills(profile.pills || CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const })));
      setBgColor(profile.background_color || '');
      setBgHex(profile.background_color || '');
      setUseViewerThemeForSpaces(profile.use_viewer_theme_for_boards || false);
      loadedProfileOnOpenRef.current = true;
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
    if (!isOpen) return;
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
  }, [isOpen, bgColor, profile?.background_color]);

  // Keep the color wheel in sync with the active theme's background when
  // no custom color is picked
  useEffect(() => {
    if (!isOpen) return;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--news-bg').trim();
    setThemeBg(/^#[0-9a-fA-F]{6}$/.test(v) ? v : '');
  }, [isOpen, localTheme, bgColor, profile?.background_color]);

  // Coordinated loader for spaces + playrooms + playroomSpaces.
  // Preloads in the background as soon as the user is signed in, and refreshes
  // silently on open so the Playrooms/Spaces tab renders with zero flicker.
  const loadCollections = async (options?: {
    silent?: boolean;
    targetPlayroomId?: string | null;
    targetSpaceId?: string | null;
  }) => {
    if (!user) return;
    const silent = options?.silent ?? collectionsLoadedForUserRef.current === user.id;
    if (!silent) setCollectionsLoading(true);
    try {
      const [loadedSpaces, initialRooms] = await Promise.all([
        getUserSpaces(user.id),
        getUserPlayrooms(user.id),
      ]);
      let rooms = initialRooms;
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
      const wantedPlayroomId = options?.targetPlayroomId ?? initialEditPlayroomId;
      const targetRoom = (wantedPlayroomId && rooms.find((r) => r.id === wantedPlayroomId)) || rooms[0];
      const loadedPlayroomSpaces = targetRoom ? await getPlayroomSpaces(targetRoom.id) : [];

      setSpaces(loadedSpaces);
      setPlayrooms(rooms);
      setPlayroomSpaces(loadedPlayroomSpaces);
      collectionsLoadedForUserRef.current = user.id;

      if (wantedPlayroomId && targetRoom) {
        setEditingPlayroom((prev) => prev || toEditingPlayroom(targetRoom));
      }
      const wantedSpaceId = options?.targetSpaceId ?? initialEditSpaceId;
      if (wantedSpaceId) {
        const foundSpace = loadedSpaces.find((s) => s.id === wantedSpaceId);
        if (foundSpace) {
          setEditingSpace((prev) => prev || toEditingSpace(foundSpace));
        }
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load playrooms');
      }
    } finally {
      if (!silent) setCollectionsLoading(false);
    }
  };

  // Preload spaces + playrooms as soon as `user?.id` is known (even before dialog opens)
  useEffect(() => {
    if (!user?.id) {
      collectionsLoadedForUserRef.current = null;
      setSpaces([]);
      setPlayrooms([]);
      setPlayroomSpaces([]);
      return;
    }
    if (collectionsLoadedForUserRef.current !== user.id) {
      loadCollections({ silent: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refresh silently when dialog opens (or load if not yet loaded)
  useEffect(() => {
    if (!isOpen || !user) return;
    const alreadyHaveTarget =
      !!initialEditPlayroom ||
      !!initialEditSpace ||
      collectionsLoadedForUserRef.current === user.id;
    loadCollections({
      silent: alreadyHaveTarget,
      targetPlayroomId: initialEditPlayroomId,
      targetSpaceId: initialEditSpaceId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, initialEditPlayroomId, initialEditSpaceId]);

  // Query Cloudflare Worker BGE neural embeddings (debounced) while editing a space
  useEffect(() => {
    if (!isOpen || !editingSpace) {
      setWorkerEmojiMatches(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchWorkerSpaceEmojiMatches({
        id: editingSpace.id,
        name: editingSpace.name,
        slug: editingSpace.slug,
        description: editingSpace.description,
        pills: editingSpace.pills,
      }).then((matches) => {
        if (!cancelled && matches && matches.length > 0) {
          setWorkerEmojiMatches(matches);
        }
      });
    }, 320);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    editingSpace?.id,
    editingSpace?.name,
    editingSpace?.slug,
    editingSpace?.description,
    editingSpace?.pills,
  ]);

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
        if (usernameStatus === 'taken') throw new Error('That handle is taken');
        if (usernameStatus === 'invalid') throw new Error('Handle must be 3-30 chars: letters, numbers, underscores');
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
      return [...prev, { id: pillId, type: 'category' as const }];
    });
  };

  /** Snapshot a space's topics as match keywords for a space interest pill. */
  const spaceInterestKeywords = (space: Space): string => {
    const terms: string[] = [];
    for (const p of space.pills || []) {
      if (p.type === 'category' || p.type === 'keyword') terms.push(p.id);
      else if (p.type === 'custom') {
        if (p.keywords) terms.push(p.keywords);
        if (p.label) terms.push(p.label);
      }
    }
    return terms.join(', ');
  };

  /** Check if a pill represents a given user space (supports both 'space-<id>' and legacy 'board-<id>'). */
  const isPillForSpace = (pill: PillConfig, spaceId: string) =>
    pill.id === `space-${spaceId}` || pill.id === `board-${spaceId}`;

  /** Toggle one of the user's spaces as an interest (boosts matching stories on the homepage). */
  const toggleSpacePill = (space: Space) => {
    const pillId = `space-${space.id}`;
    setPills((prev) => {
      if (prev.some((p) => isPillForSpace(p, space.id))) {
        return prev.filter((p) => !isPillForSpace(p, space.id));
      }
      const keywords = spaceInterestKeywords(space);
      return [
        ...prev,
        {
          id: pillId,
          type: 'space' as const,
          label: space.name,
          keywords: keywords || undefined,
          icon: getSpaceEmoji(space),
        },
      ];
    });
  };

  const addCustomPill = () => {
    if (!newPillLabel.trim()) return;
    const id = `custom-${Date.now()}`;
    const label = newPillLabel.trim();
    const keywords = newPillKeywords.trim() || undefined;
    const icon = getClosestEmojiForText(label, keywords);
    setPills((prev) => [...prev, { id, type: 'custom', label, keywords, icon }]);
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

  const handleResetInterests = async () => {
    const defaultPills: PillConfig[] = CATEGORIES.map((c) => ({ id: c.id, type: 'category' as const }));
    setPills(defaultPills);
    setSaving(true);
    try {
      await updateProfile({ pills: defaultPills });
      notify('Interests reset to default', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to reset interests', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- Spaces ----
  const handleNewSpace = () => {
    if (spaces.length >= MAX_SPACES) return;
    setShowSpaceEmojiPicker(false);
    setEmojiSearchQuery('');
    setCustomEmojiInput('');
    setNewPillLabel('');
    setNewPillKeywords('');
    setEditingSpace({
      id: null,
      name: '',
      slug: '',
      description: '',
      logoUrl: null,
      logoFile: null,
      iconEmoji: null,
      // Do not carry over custom interests or space pills into a new space
      pills: pills.filter((p) => p.type !== 'custom' && p.type !== 'space' && p.type !== 'board'),
    });
  };

  const handleEditSpace = (space: Space) => {
    setShowSpaceEmojiPicker(false);
    setEmojiSearchQuery('');
    setCustomEmojiInput('');
    setNewPillLabel('');
    setNewPillKeywords('');
    setEditingSpace(toEditingSpace(space));
  };

  const handleSpaceLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (spaceLogoRef.current) spaceLogoRef.current.value = '';
    if (!file || !editingSpace) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }
    if (editingSpace.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingSpace.logoUrl);
    setEditingSpace({ ...editingSpace, logoUrl: URL.createObjectURL(file), logoFile: file });
  };

  const handleSpacePillToggle = (pill: PillConfig) => {
    if (!editingSpace) return;
    const exists = editingSpace.pills.some((p) => p.type === pill.type && p.id === pill.id);
    setEditingSpace({
      ...editingSpace,
      pills: exists
        ? editingSpace.pills.filter((p) => !(p.type === pill.type && p.id === pill.id))
        : [...editingSpace.pills, pill],
    });
  };

  const addCustomSpacePill = () => {
    if (!editingSpace || !newPillLabel.trim()) return;
    const label = newPillLabel.trim();
    const alreadyExists = editingSpace.pills.some(
      (p) => p.type === 'custom' && (p.label || '').trim().toLowerCase() === label.toLowerCase()
    );
    if (alreadyExists) {
      setNewPillLabel('');
      setNewPillKeywords('');
      return;
    }
    const id = `custom-${Date.now()}`;
    const keywords = newPillKeywords.trim() || undefined;
    const pill: PillConfig = {
      id,
      type: 'custom',
      label,
      keywords,
      icon: getClosestEmojiForText(label, keywords),
    };
    setEditingSpace({ ...editingSpace, pills: [...editingSpace.pills, pill] });
    setNewPillLabel('');
    setNewPillKeywords('');
  };

  const handleSaveSpace = async () => {
    if (!editingSpace || !user) return;
    const name = editingSpace.name.trim();
    if (!name) {
      setError('Give your space a name');
      return;
    }
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const slug = await ensureUniqueSlug(
        user.id,
        slugify(editingSpace.slug.trim() || name),
        editingSpace.id || undefined
      );
      let logoUrl = editingSpace.logoUrl;
      const iconEmojiOverride = extractSingleEmoji(editingSpace.iconEmoji) || null;
      // New spaces: create first (need the id for the logo path), then upload
      // Spaces are interest-defined feeds: theme/background live on the playroom, not the space.
      const isNewSpace = !editingSpace.id;
      let spaceId = editingSpace.id;
      if (!spaceId) {
        const created = await createSpace(user.id, {
          name,
          slug,
          description: editingSpace.description.trim() || null,
          logo_url: null,
          icon_emoji: iconEmojiOverride,
          theme: null,
          background_color: null,
          pills: editingSpace.pills,
          position: spaces.length,
        });
        spaceId = created.id;
      }
      if (editingSpace.logoFile && spaceId) {
        logoUrl = await uploadSpaceLogo(user.id, spaceId, editingSpace.logoFile);
      }
      const updated = await updateSpace(spaceId, {
        name,
        slug,
        description: editingSpace.description.trim() || null,
        logo_url: editingSpace.logoFile ? logoUrl : editingSpace.logoUrl,
        icon_emoji: iconEmojiOverride,
        theme: null,
        background_color: null,
        pills: editingSpace.pills,
      });
      if (editingSpace.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingSpace.logoUrl);
      setSpaces((prev) => {
        const exists = prev.some((s) => s.id === updated.id);
        const next = exists ? prev.map((s) => (s.id === updated.id ? updated : s)) : [...prev, updated];
        return next.sort((a, b) => a.position - b.position);
      });
      // Keep any homepage space pill for this space in sync with its updated name, keywords, and emoji
      const resolvedIcon = getSpaceEmoji(updated);
      const updatedKeywords = spaceInterestKeywords(updated);
      setPills((prev) => {
        if (!prev.some((p) => isPillForSpace(p, updated.id))) return prev;
        const synced = prev.map((p) =>
          isPillForSpace(p, updated.id)
            ? { ...p, label: updated.name, keywords: updatedKeywords || undefined, icon: resolvedIcon }
            : p
        );
        updateProfile({ pills: synced }).catch(() => {});
        return synced;
      });
      if (isNewSpace) {
        const defaultPlayroom = playrooms[0];
        if (defaultPlayroom && playroomSpaces.length < MAX_PLAYROOM_SPACES) {
          try {
            await addSpaceToPlayroom(defaultPlayroom.id, updated.id, MAX_PLAYROOM_SPACES);
            setPlayroomSpaces((prev) =>
              prev.some((s) => s.id === updated.id) ? prev : [...prev, updated]
            );
          } catch {
            /* non-fatal if playroom is already at capacity */
          }
        }
      } else {
        setPlayroomSpaces((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
      setEditingSpace(null);
      setShowSpaceEmojiPicker(false);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('littlables:spaces-changed', { detail: { space: updated } }));
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save space');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpace = async (spaceId: string) => {
    setError('');
    setConfirmDeleteSpaceId(null);
    try {
      await deleteSpace(spaceId);
      setSpaces((prev) => prev.filter((s) => s.id !== spaceId));
      setPlayroomSpaces((prev) => prev.filter((s) => s.id !== spaceId));
      if (editingSpace?.id === spaceId) setEditingSpace(null);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('littlables:spaces-changed'));
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete space');
    }
  };

  const handleMoveSpace = async (spaceId: string, dir: -1 | 1) => {
    const idx = spaces.findIndex((s) => s.id === spaceId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= spaces.length) return;
    const next = [...spaces];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setSpaces(next);
    try {
      await reorderSpaces(next.map((s) => s.id));
      window.dispatchEvent(new CustomEvent('littlables:spaces-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
      loadCollections({ silent: true });
    }
  };

  // ---- Playrooms ----
  const handleNewPlayroom = () => {
    if (playrooms.length >= MAX_PLAYROOMS) return;
    setConfirmDeletePlayroomId(null);
    setConfirmRemoveSpaceId(null);
    setShowAddSpacePicker(false);
    setPlayroomSpaces([]);
    setEditingPlayroom({
      id: null,
      name: '',
      slug: '',
      description: '',
      logoUrl: null,
      logoFile: null,
      theme: '',
      bgColor: '',
    });
  };

  const handleEditPlayroom = async (playroom: Playroom) => {
    setConfirmDeletePlayroomId(null);
    setConfirmRemoveSpaceId(null);
    setShowAddSpacePicker(false);
    setEditingPlayroom(toEditingPlayroom(playroom));
    try {
      setPlayroomSpaces(await getPlayroomSpaces(playroom.id));
    } catch {
      /* keep current spaces on transient error */
    }
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
        editingPlayroom.id || undefined
      );
      let logoUrl = editingPlayroom.logoUrl;
      const isNewPlayroom = !editingPlayroom.id;
      let playroomId = editingPlayroom.id;

      if (!playroomId) {
        const created = await createPlayroom(user.id, {
          name,
          slug,
          description: editingPlayroom.description.trim() || null,
          logo_url: null,
          theme: editingPlayroom.theme || null,
          background_color: editingPlayroom.bgColor || null,
          position: playrooms.length,
        });
        playroomId = created.id;
      }

      if (editingPlayroom.logoFile && playroomId) {
        logoUrl = await uploadPlayroomLogo(user.id, playroomId, editingPlayroom.logoFile);
      }

      const updated = await updatePlayroom(playroomId, {
        name,
        slug,
        description: editingPlayroom.description.trim() || null,
        logo_url: editingPlayroom.logoFile ? logoUrl : editingPlayroom.logoUrl,
        theme: editingPlayroom.theme || null,
        background_color: editingPlayroom.bgColor || null,
      });

      if (isNewPlayroom && playroomSpaces.length > 0) {
        for (const s of playroomSpaces) {
          await addSpaceToPlayroom(updated.id, s.id, MAX_PLAYROOM_SPACES);
        }
      }

      if (editingPlayroom.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingPlayroom.logoUrl);
      setPlayrooms((prev) => {
        const exists = prev.some((p) => p.id === updated.id);
        const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
        return next.sort((a, b) => a.position - b.position);
      });
      setEditingPlayroom(null);
      setShowAddSpacePicker(false);
      setSaved(true);
      // Tell the public profile and playroom pages to refetch (they won't remount on dialog close)
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed', { detail: { playroom: updated } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save playroom');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlayroom = async (playroomId: string) => {
    setError('');
    setConfirmDeletePlayroomId(null);
    try {
      await deletePlayroom(playroomId);
      setPlayrooms((prev) => prev.filter((p) => p.id !== playroomId));
      if (editingPlayroom?.id === playroomId) setEditingPlayroom(null);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete playroom');
    }
  };

  const handleMovePlayroom = async (playroomId: string, dir: -1 | 1) => {
    const idx = playrooms.findIndex((p) => p.id === playroomId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= playrooms.length) return;
    const next = [...playrooms];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setPlayrooms(next);
    try {
      await reorderPlayrooms(next.map((p) => p.id));
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder playrooms');
      loadCollections({ silent: true });
    }
  };

  const handleAddSpaceToPlayroom = async (spaceId: string) => {
    if (playroomSpaces.length >= MAX_PLAYROOM_SPACES) {
      setError(`A playroom can hold at most ${MAX_PLAYROOM_SPACES} spaces`);
      return;
    }
    setError('');
    if (editingPlayroom && !editingPlayroom.id) {
      const targetSpace = spaces.find((s) => s.id === spaceId);
      if (targetSpace && !playroomSpaces.some((ps) => ps.id === spaceId)) {
        setPlayroomSpaces((prev) => [...prev, targetSpace]);
      }
      setShowAddSpacePicker(false);
      return;
    }
    const playroom = (editingPlayroom?.id && playrooms.find((p) => p.id === editingPlayroom.id)) || playrooms[0];
    if (!playroom) return;
    try {
      await addSpaceToPlayroom(playroom.id, spaceId, MAX_PLAYROOM_SPACES);
      setPlayroomSpaces(await getPlayroomSpaces(playroom.id));
      setShowAddSpacePicker(false);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add space');
    }
  };

  const handleRemoveSpaceFromPlayroom = async (spaceId: string) => {
    setError('');
    setConfirmRemoveSpaceId(null);
    if (editingPlayroom && !editingPlayroom.id) {
      setPlayroomSpaces((prev) => prev.filter((b) => b.id !== spaceId));
      return;
    }
    const playroom = (editingPlayroom?.id && playrooms.find((p) => p.id === editingPlayroom.id)) || playrooms[0];
    if (!playroom) return;
    try {
      await removeSpaceFromPlayroom(playroom.id, spaceId);
      setPlayroomSpaces((prev) => prev.filter((b) => b.id !== spaceId));
      setSaved(true);
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove space');
    }
  };

  const handleMovePlayroomSpace = async (spaceId: string, dir: -1 | 1) => {
    const idx = playroomSpaces.findIndex((s) => s.id === spaceId);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= playroomSpaces.length) return;
    const next = [...playroomSpaces];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setPlayroomSpaces(next);
    if (editingPlayroom && !editingPlayroom.id) {
      return;
    }
    const playroom = (editingPlayroom?.id && playrooms.find((p) => p.id === editingPlayroom.id)) || playrooms[0];
    if (!playroom) return;
    try {
      await reorderPlayroomSpaces(playroom.id, next.map((s) => s.id));
      window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder spaces');
      loadCollections({ silent: true });
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

  /**
   * Saves all pending changes across Profile, Avatar, Theme, Interests,
   * and any open Playroom or Space editor in a single action.
   */
  const handleSaveAll = async () => {
    if (!user) return;
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      // 1. Validate handle if changed
      if (username && username !== profile?.username) {
        if (usernameStatus === 'taken') throw new Error('That handle is taken');
        if (usernameStatus === 'invalid' || !/^[a-z0-9_]{3,30}$/.test(username)) {
          throw new Error('Handle must be 3-30 chars: letters, numbers, underscores');
        }
      }

      // 2. Validate active Space/Playroom editor if on the Playrooms tab
      if (editingSpace && !editingSpace.name.trim() && tab === 'playrooms') {
        throw new Error('Give your space a name');
      }
      if (editingPlayroom && !editingPlayroom.name.trim() && tab === 'playrooms') {
        throw new Error('Give your playroom a name');
      }

      let nextPills = [...pills];
      // If user typed a custom interest on the Interests tab without clicking Add yet, include it
      if (tab === 'interests' && newPillLabel.trim()) {
        const label = newPillLabel.trim();
        const keywords = newPillKeywords.trim() || undefined;
        const alreadyInPills = nextPills.some(
          (p) => p.type === 'custom' && (p.label || '').trim().toLowerCase() === label.toLowerCase()
        );
        if (!alreadyInPills) {
          nextPills.push({
            id: `custom-${Date.now()}`,
            type: 'custom',
            label,
            keywords,
            icon: getClosestEmojiForText(label, keywords),
          });
        }
        setNewPillLabel('');
        setNewPillKeywords('');
      }

      // 3. Save open Space editor if it has a name
      if (editingSpace && editingSpace.name.trim()) {
        const spaceName = editingSpace.name.trim();
        let spacePills = [...editingSpace.pills];
        if (tab === 'playrooms' && newPillLabel.trim()) {
          const label = newPillLabel.trim();
          const keywords = newPillKeywords.trim() || undefined;
          const alreadyExists = spacePills.some(
            (p) => p.type === 'custom' && (p.label || '').trim().toLowerCase() === label.toLowerCase()
          );
          if (!alreadyExists) {
            spacePills.push({
              id: `custom-${Date.now()}`,
              type: 'custom',
              label,
              keywords,
              icon: getClosestEmojiForText(label, keywords),
            });
          }
          setNewPillLabel('');
          setNewPillKeywords('');
        }

        const slug = await ensureUniqueSlug(
          user.id,
          slugify(editingSpace.slug.trim() || spaceName),
          editingSpace.id || undefined
        );
        let logoUrl = editingSpace.logoUrl;
        const iconEmojiOverride = extractSingleEmoji(editingSpace.iconEmoji) || null;
        const isNewSpace = !editingSpace.id;
        let spaceId = editingSpace.id;
        if (!spaceId) {
          const created = await createSpace(user.id, {
            name: spaceName,
            slug,
            description: editingSpace.description.trim() || null,
            logo_url: null,
            icon_emoji: iconEmojiOverride,
            theme: null,
            background_color: null,
            pills: spacePills,
            position: spaces.length,
          });
          spaceId = created.id;
        }
        if (editingSpace.logoFile && spaceId) {
          logoUrl = await uploadSpaceLogo(user.id, spaceId, editingSpace.logoFile);
        }
        const updatedSpace = await updateSpace(spaceId, {
          name: spaceName,
          slug,
          description: editingSpace.description.trim() || null,
          logo_url: editingSpace.logoFile ? logoUrl : editingSpace.logoUrl,
          icon_emoji: iconEmojiOverride,
          theme: null,
          background_color: null,
          pills: spacePills,
        });
        if (editingSpace.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingSpace.logoUrl);
        setSpaces((prev) => {
          const exists = prev.some((s) => s.id === updatedSpace.id);
          const next = exists
            ? prev.map((s) => (s.id === updatedSpace.id ? updatedSpace : s))
            : [...prev, updatedSpace];
          return next.sort((a, b) => a.position - b.position);
        });
        const resolvedIcon = getSpaceEmoji(updatedSpace);
        const updatedKeywords = spaceInterestKeywords(updatedSpace);
        if (nextPills.some((p) => isPillForSpace(p, updatedSpace.id))) {
          nextPills = nextPills.map((p) =>
            isPillForSpace(p, updatedSpace.id)
              ? {
                  ...p,
                  label: updatedSpace.name,
                  keywords: updatedKeywords || undefined,
                  icon: resolvedIcon,
                }
              : p
          );
        }
        if (isNewSpace) {
          const defaultPlayroom = playrooms[0];
          if (defaultPlayroom && playroomSpaces.length < MAX_PLAYROOM_SPACES) {
            try {
              await addSpaceToPlayroom(defaultPlayroom.id, updatedSpace.id, MAX_PLAYROOM_SPACES);
              setPlayroomSpaces((prev) =>
                prev.some((s) => s.id === updatedSpace.id) ? prev : [...prev, updatedSpace]
              );
            } catch {
              /* non-fatal if playroom is already at capacity */
            }
          }
        } else {
          setPlayroomSpaces((prev) =>
            prev.map((s) => (s.id === updatedSpace.id ? updatedSpace : s))
          );
        }
        setEditingSpace(null);
        setShowSpaceEmojiPicker(false);
        window.dispatchEvent(
          new CustomEvent('littlables:spaces-changed', { detail: { space: updatedSpace } })
        );
        window.dispatchEvent(new CustomEvent('littlables:playrooms-changed'));
      }

      // 4. Save open Playroom editor if it has a name
      if (editingPlayroom && editingPlayroom.name.trim()) {
        const playroomName = editingPlayroom.name.trim();
        const slug = await ensureUniquePlayroomSlug(
          user.id,
          slugify(editingPlayroom.slug.trim() || playroomName),
          editingPlayroom.id || undefined
        );
        let logoUrl = editingPlayroom.logoUrl;
        const isNewPlayroom = !editingPlayroom.id;
        let playroomId = editingPlayroom.id;
        if (!playroomId) {
          const created = await createPlayroom(user.id, {
            name: playroomName,
            slug,
            description: editingPlayroom.description.trim() || null,
            logo_url: null,
            theme: editingPlayroom.theme || null,
            background_color: editingPlayroom.bgColor || null,
            position: playrooms.length,
          });
          playroomId = created.id;
        }
        if (editingPlayroom.logoFile && playroomId) {
          logoUrl = await uploadPlayroomLogo(user.id, playroomId, editingPlayroom.logoFile);
        }
        const updatedPlayroom = await updatePlayroom(playroomId, {
          name: playroomName,
          slug,
          description: editingPlayroom.description.trim() || null,
          logo_url: editingPlayroom.logoFile ? logoUrl : editingPlayroom.logoUrl,
          theme: editingPlayroom.theme || null,
          background_color: editingPlayroom.bgColor || null,
        });
        if (isNewPlayroom && playroomSpaces.length > 0) {
          for (const s of playroomSpaces) {
            await addSpaceToPlayroom(updatedPlayroom.id, s.id, MAX_PLAYROOM_SPACES);
          }
        }
        if (editingPlayroom.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingPlayroom.logoUrl);
        setPlayrooms((prev) => {
          const exists = prev.some((p) => p.id === updatedPlayroom.id);
          const next = exists
            ? prev.map((p) => (p.id === updatedPlayroom.id ? updatedPlayroom : p))
            : [...prev, updatedPlayroom];
          return next.sort((a, b) => a.position - b.position);
        });
        setEditingPlayroom(null);
        setShowAddSpacePicker(false);
        window.dispatchEvent(
          new CustomEvent('littlables:playrooms-changed', { detail: { playroom: updatedPlayroom } })
        );
      }

      // 5. Upload pending avatar if selected
      let avatarUpdates: Partial<Profile> = {};
      if (pendingAvatar) {
        let uploadedUrl = pendingAvatar.url;
        if (pendingAvatar.file) {
          uploadedUrl = await uploadAvatarFile(pendingAvatar.file);
        }
        avatarUpdates = {
          avatar_type: pendingAvatar.type,
          avatar_character: pendingAvatar.characterId,
          avatar_url: uploadedUrl,
        };
      }

      // 6. Save all profile, avatar, theme, and interest fields together
      const normalizedSocials = Object.fromEntries(
        Object.entries(socials).map(([k, v]) => [k, normalizeSocialLink(k, v || '')])
      ) as SocialLinks;

      setPills(nextPills);
      await updateProfile({
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        social_links: normalizedSocials,
        theme: localTheme,
        background_color: bgColor || null,
        use_viewer_theme_for_boards: useViewerThemeForSpaces,
        pills: nextPills,
        ...avatarUpdates,
      });

      if (pendingAvatar) {
        if (pendingAvatar.url?.startsWith('blob:')) URL.revokeObjectURL(pendingAvatar.url);
        setPendingAvatar(null);
      }

      notify('All changes saved!', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
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
    { id: 'theme', label: 'Theme' },
    { id: 'interests', label: 'Interests' },
    { id: 'playrooms', label: 'Playrooms' },
  ];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog profile-dialog-expanded" onClick={(e) => e.stopPropagation()}>
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
            <div className="profile-avatar-row" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
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
                <div style={{ minWidth: 0 }}>
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
              <button
                type="button"
                className="sign-in-button secondary-button compact-inline-btn"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>

            <div className="compact-form-stack">
              <div className="compact-field-row">
                <label className="compact-field-label" htmlFor="profile-display-name">Name</label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={50}
                />
              </div>

              <div className="compact-field-row">
                <label className="compact-field-label" htmlFor="profile-username">Handle</label>
                <div className="compact-field-control">
                  <div className="space-slug-row">
                    <span className="space-slug-prefix">@</span>
                    <input
                      id="profile-username"
                      className="space-slug-input"
                      type="text"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="handle"
                      maxLength={30}
                    />
                  </div>
                  {usernameStatus === 'checking' && <span className="username-hint">Checking…</span>}
                  {usernameStatus === 'available' && <span className="username-hint available">✓ Available</span>}
                  {usernameStatus === 'taken' && <span className="username-hint taken">✗ Taken</span>}
                  {usernameStatus === 'invalid' && <span className="username-hint taken">3-30 chars</span>}
                </div>
              </div>

              <div className="compact-field-row compact-field-row-top">
                <label className="compact-field-label" htmlFor="profile-bio">Bio</label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself…"
                  maxLength={280}
                  rows={2}
                  className="profile-textarea"
                />
              </div>

              <div className="compact-section-header">
                <label className="profile-section-label">Social links</label>
                <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                  Handle or full link
                </span>
              </div>
              <div className="social-fields-grid">
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
              </div>

              <div className="space-editor-actions">
                <button type="button" className="sign-in-button primary-button" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'avatar' && (
          <div className="profile-tab-content">
            <div className="profile-avatar-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {renderAvatar('lg')}
                <div>
                  <button
                    type="button"
                    className="sign-in-button secondary-button compact-inline-btn"
                    onClick={() => fileRef.current?.click()}
                  >
                    Upload photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </div>
              </div>
              <div className="avatar-alt-options">
                {googlePicUrl && (
                  <button type="button" className="link-button" onClick={handleGoogleAvatar}>
                    Use Google photo
                  </button>
                )}
                <button type="button" className="link-button" onClick={handleInitialAvatar}>
                  Use initial letter
                </button>
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

            <div className="space-editor-actions">
              <button
                type="button"
                className="sign-in-button primary-button"
                onClick={handleSaveAvatar}
                disabled={saving || !pendingAvatar}
              >
                {saving ? 'Saving…' : 'Save Avatar'}
              </button>
            </div>
          </div>
        )}

        {tab === 'interests' && (
          <div className="profile-tab-content">
            <div className="compact-section-header" style={{ marginTop: 0 }}>
              <label className="profile-section-label">Your interests (in order)</label>
              <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                Shapes your playroom feed
              </span>
            </div>
            <div className="pill-list">
              {pills.map((pill, index) => {
                const cat = CATEGORIES.find((c) => c.id === pill.id);
                const space =
                  pill.type === 'space' || pill.type === 'board'
                    ? spaces.find((s) => isPillForSpace(pill, s.id))
                    : undefined;
                const label =
                  pill.type === 'custom' || pill.type === 'space' || pill.type === 'board'
                    ? (pill.label || pill.id)
                    : (cat ? t(cat.i18nKey as keyof TranslationStrings) || cat.id : pill.id);
                const icon = cat ? cat.icon : getPillEmoji(pill, spaces);
                return (
                  <div key={pill.id} className="pill-row">
                    <span className="pill-icon">
                      {space?.logo_url ? (
                        <img src={space.logo_url} alt="" className="pill-space-logo" />
                      ) : space ? (
                        getSpaceEmoji(space)
                      ) : (
                        icon
                      )}
                    </span>
                    <span className="pill-label">{label}</span>
                    <button type="button" className="pill-remove" onClick={() => removeCustomPill(pill.id)} aria-label="Remove">×</button>
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

            {spaces.length > 0 && (
              <>
                <label className="profile-section-label">Your spaces</label>
                <div className="pill-toggle-grid">
                  {spaces.map((space) => {
                    const active = pills.some((p) => isPillForSpace(p, space.id));
                    return (
                      <button
                        key={space.id}
                        type="button"
                        className={`pill-toggle ${active ? 'active' : ''}`}
                        onClick={() => toggleSpacePill(space)}
                      >
                        {space.logo_url ? (
                          <img src={space.logo_url} alt="" className="pill-toggle-logo" />
                        ) : (
                          <span>{getSpaceEmoji(space)}</span>
                        )}{' '}
                        {space.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="compact-field-row" style={{ marginTop: '0.2rem' }}>
              <label className="compact-field-label">Custom</label>
              <div className="space-custom-pill-row" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  className="space-input"
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
            </div>

            <div className="space-editor-actions">
              <button
                type="button"
                className="sign-in-button primary-button"
                onClick={handleSaveInterests}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save interests'}
              </button>
              <button
                type="button"
                className="sign-in-button secondary-button"
                onClick={handleResetInterests}
                disabled={saving}
              >
                Reset to default
              </button>
            </div>
          </div>
        )}

        {tab === 'theme' && (
          <div className="profile-tab-content">
            <label className="profile-section-label" style={{ marginTop: 0 }}>Theme</label>
            <div className="theme-grid">
              {THEMES.map((themeOption) => (
                <button
                  key={themeOption.id}
                  type="button"
                  className={`theme-option ${localTheme === themeOption.id ? 'selected' : ''}`}
                  data-umami-event="Select-Theme"
                  data-umami-event-theme={themeOption.id}
                  onClick={() => handleThemeSelect(themeOption.id)}
                >
                  <span className="theme-icon">{themeOption.icon}</span>
                  <span className="theme-name">{themeOption.name}</span>
                </button>
              ))}
            </div>

            <div className="compact-field-row" style={{ marginTop: '0.25rem' }}>
              <label className="compact-field-label">Bg color</label>
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
                <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                  Overrides theme
                </span>
                {(bgColor || profile?.background_color) && (
                  <button type="button" className="link-button" onClick={handleClearBg}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="compact-prefs-group">
              <div className="compact-pref-item">
                <label className="compact-pref-toggle">
                  <input
                    type="checkbox"
                    checked={useViewerThemeForSpaces}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setUseViewerThemeForSpaces(next);
                      updateProfile({ use_viewer_theme_for_boards: next })
                        .then(() => notify('Preference saved', 'success'))
                        .catch((err) => notify(err instanceof Error ? err.message : 'Failed to save', 'error'));
                    }}
                  />
                  <span>Always use my theme when viewing others' spaces</span>
                </label>
                <p className="profile-hint profile-hint-compact" style={{ margin: '0 0 0 1.4rem' }}>
                  Visits to other playrooms and spaces appear in your theme instead of the owner's.
                </p>
              </div>

              <div className="compact-pref-item">
                <label className="compact-pref-toggle">
                  <input
                    type="checkbox"
                    checked={systemFont}
                    onChange={(e) => setSystemFont(e.target.checked)}
                  />
                  <span>Use system font</span>
                </label>
                <p className="profile-hint profile-hint-compact" style={{ margin: '0 0 0 1.4rem' }}>
                  Uses your device's default font instead of Fredoka, Quicksand, and Varela Round.
                </p>
              </div>
            </div>

            <div className="space-editor-actions">
              <button type="button" className="sign-in-button primary-button" onClick={handleSaveTheme} disabled={saving}>
                {saving ? 'Saving…' : 'Save Theme'}
              </button>
            </div>
          </div>
        )}

        {tab === 'playrooms' && (
          <div className="profile-tab-content">
            {collectionsLoading && !editingPlayroom && !editingSpace && playrooms.length === 0 && spaces.length === 0 ? (
              <p className="profile-hint">Loading playrooms and spaces…</p>
            ) : (
              <>
                {/* Playroom section (hidden while editing a space) */}
                {!editingSpace && (
                  <>
                    {editingPlayroom ? (
                      <>
                        <div className="compact-editor-header">
                          <label className="profile-section-label">
                            {editingPlayroom.id ? 'Edit playroom' : 'New playroom'}
                          </label>
                          <button type="button" className="link-button" onClick={() => setEditingPlayroom(null)}>
                            ← Back to playrooms
                          </button>
                        </div>

                        <div className="compact-form-stack">
                          <div className="compact-field-row">
                            <label className="compact-field-label">Name</label>
                            <input
                              type="text"
                              className="space-input"
                              value={editingPlayroom.name}
                              onChange={(e) => setEditingPlayroom({ ...editingPlayroom, name: e.target.value })}
                              placeholder="My playroom"
                              maxLength={60}
                            />
                          </div>

                          <div className="compact-field-row">
                            <label className="compact-field-label">URL</label>
                            <div className="space-slug-row">
                              <span className="space-slug-prefix">@{profile?.username || 'you'}/</span>
                              <input
                                type="text"
                                className="space-input space-slug-input"
                                value={editingPlayroom.slug}
                                onChange={(e) => setEditingPlayroom({ ...editingPlayroom, slug: sanitizeSlugInput(e.target.value) })}
                                placeholder={slugify(editingPlayroom.name) || 'my-playroom'}
                                maxLength={50}
                              />
                            </div>
                          </div>

                          <div className="compact-field-row compact-field-row-top">
                            <label className="compact-field-label">Description</label>
                            <textarea
                              className="space-input space-description-input"
                              value={editingPlayroom.description}
                              onChange={(e) => setEditingPlayroom({ ...editingPlayroom, description: e.target.value })}
                              placeholder="What is this playroom about? (optional)"
                              maxLength={280}
                              rows={2}
                            />
                          </div>

                          <div className="compact-field-row">
                            <label className="compact-field-label">Logo</label>
                            <div className="space-logo-row">
                              {editingPlayroom.logoUrl ? (
                                <img src={editingPlayroom.logoUrl} alt="Playroom logo preview" className="space-logo-preview" />
                              ) : (
                                <span className="space-row-logo-fallback space-logo-preview">
                                  {(editingPlayroom.name || '?')[0].toUpperCase()}
                                </span>
                              )}
                              <input
                                ref={playroomLogoRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handlePlayroomLogoPick}
                              />
                              <button
                                type="button"
                                className="sign-in-button secondary-button compact-inline-btn"
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

                          <div className="compact-field-row compact-field-row-top">
                            <label className="compact-field-label">Theme</label>
                            <div className="space-theme-row">
                              <button
                                type="button"
                                className={`theme-option ${editingPlayroom.theme === '' ? 'selected' : ''}`}
                                onClick={() => setEditingPlayroom({ ...editingPlayroom, theme: '' })}
                              >
                                <span className="theme-name">Profile theme</span>
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
                                <span className="theme-name">None</span>
                              </button>
                            </div>
                          </div>

                          <div className="compact-field-row">
                            <label className="compact-field-label">Bg color</label>
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
                          </div>
                        </div>

                        <div className="compact-section-header">
                          <label className="profile-field-label">
                            Spaces in this playroom ({playroomSpaces.length} of {MAX_PLAYROOM_SPACES})
                          </label>
                          {!showAddSpacePicker && (
                            <button
                              type="button"
                              className="sign-in-button secondary-button compact-inline-btn"
                              onClick={() => setShowAddSpacePicker(true)}
                              disabled={playroomSpaces.length >= MAX_PLAYROOM_SPACES}
                            >
                              + Add space
                            </button>
                          )}
                        </div>
                        {playroomSpaces.length === 0 ? (
                          <p className="profile-hint profile-hint-compact">
                            No spaces yet — click "+ Add space" to build the feed.
                          </p>
                        ) : (
                          <div className="space-list">
                            {playroomSpaces.map((space, i) => (
                              <div key={space.id} className="space-row">
                                {space.logo_url ? (
                                  <img src={space.logo_url} alt="" className="space-row-logo" />
                                ) : (
                                  <span className="space-row-logo-fallback">
                                    {(space.name || '?')[0].toUpperCase()}
                                  </span>
                                )}
                                <div className="space-row-info">
                                  <div className="space-row-name">{space.name}</div>
                                  <div className="space-row-slug">
                                    @{profile?.username}/{editingPlayroom.slug || slugify(editingPlayroom.name) || 'my-playroom'}/{space.slug}
                                  </div>
                                </div>
                                <div className="space-row-actions">
                                  {confirmRemoveSpaceId === space.id ? (
                                    <div className="space-confirm-actions">
                                      <span className="space-confirm-label">Remove?</span>
                                      <button
                                        type="button"
                                        className="space-confirm-btn space-confirm-danger"
                                        onClick={() => handleRemoveSpaceFromPlayroom(space.id)}
                                      >
                                        Remove
                                      </button>
                                      <button
                                        type="button"
                                        className="space-confirm-btn"
                                        onClick={() => setConfirmRemoveSpaceId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="space-icon-button"
                                        title="Move up"
                                        disabled={i === 0}
                                        onClick={() => handleMovePlayroomSpace(space.id, -1)}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className="space-icon-button"
                                        title="Move down"
                                        disabled={i === playroomSpaces.length - 1}
                                        onClick={() => handleMovePlayroomSpace(space.id, 1)}
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        className="space-icon-button space-delete"
                                        title="Remove from playroom"
                                        onClick={() => setConfirmRemoveSpaceId(space.id)}
                                      >
                                        ×
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {showAddSpacePicker && (
                          <div className="playroom-add-space-picker">
                            {spaces.filter((s) => !playroomSpaces.some((ps) => ps.id === s.id)).length === 0 ? (
                              <p className="profile-hint profile-hint-compact">
                                All your spaces are already in this playroom.
                              </p>
                            ) : (
                              spaces
                                .filter((s) => !playroomSpaces.some((ps) => ps.id === s.id))
                                .map((s) => (
                                  <div key={s.id} className="space-row">
                                    <div className="space-row-info">
                                      <div className="space-row-name">{s.name}</div>
                                    </div>
                                    <div className="space-row-actions">
                                      <button
                                        type="button"
                                        className="sign-in-button secondary-button compact-inline-btn"
                                        onClick={() => handleAddSpaceToPlayroom(s.id)}
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
                              style={{ marginTop: '0.35rem' }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        <div className="space-editor-actions">
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
                            {saving ? 'Saving…' : editingPlayroom.id ? 'Save' : 'Create playroom'}
                          </button>
                          {editingPlayroom.id && (
                            confirmDeletePlayroomId === editingPlayroom.id ? (
                              <div className="space-confirm-actions">
                                <span className="space-confirm-label">Delete "{editingPlayroom.name}"?</span>
                                <button
                                  type="button"
                                  className="space-confirm-btn space-confirm-danger"
                                  onClick={() => handleDeletePlayroom(editingPlayroom.id as string)}
                                >
                                  Confirm delete
                                </button>
                                <button
                                  type="button"
                                  className="space-confirm-btn"
                                  onClick={() => setConfirmDeletePlayroomId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="sign-in-button secondary-button space-delete-button"
                                onClick={() => setConfirmDeletePlayroomId(editingPlayroom.id as string)}
                              >
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="compact-section-header" style={{ marginTop: 0 }}>
                          <label className="profile-section-label">Your playroom</label>
                          <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                            @{profile?.username || 'you'}/{playrooms[0]?.slug || 'my-playroom'}
                          </span>
                        </div>
                        {playrooms.length === 0 ? (
                          <p className="profile-hint">No playrooms yet — create your first one below.</p>
                        ) : (
                          <div className="space-list">
                            {playrooms.map((pr, i) => (
                              <div key={pr.id} className="space-row">
                                {pr.logo_url ? (
                                  <img src={pr.logo_url} alt="" className="space-row-logo" />
                                ) : (
                                  <span className="space-row-logo-fallback">
                                    {(pr.name || '?')[0].toUpperCase()}
                                  </span>
                                )}
                                <div className="space-row-info">
                                  <div className="space-row-name">{pr.name}</div>
                                  <div className="space-row-slug">@{profile?.username}/{pr.slug}</div>
                                </div>
                                <div className="space-row-actions">
                                  {confirmDeletePlayroomId === pr.id ? (
                                    <div className="space-confirm-actions">
                                      <span className="space-confirm-label">Delete?</span>
                                      <button
                                        type="button"
                                        className="space-confirm-btn space-confirm-danger"
                                        onClick={() => handleDeletePlayroom(pr.id)}
                                      >
                                        Delete
                                      </button>
                                      <button
                                        type="button"
                                        className="space-confirm-btn"
                                        onClick={() => setConfirmDeletePlayroomId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="space-icon-button"
                                        title="Move up"
                                        disabled={i === 0}
                                        onClick={() => handleMovePlayroom(pr.id, -1)}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        className="space-icon-button"
                                        title="Move down"
                                        disabled={i === playrooms.length - 1}
                                        onClick={() => handleMovePlayroom(pr.id, 1)}
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        className="space-icon-button"
                                        title="Edit playroom"
                                        onClick={() => {
                                          setConfirmDeletePlayroomId(null);
                                          handleEditPlayroom(pr);
                                        }}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        className="space-icon-button space-delete"
                                        title="Delete playroom"
                                        onClick={() => setConfirmDeletePlayroomId(pr.id)}
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="sign-in-button primary-button"
                          onClick={handleNewPlayroom}
                          disabled={playrooms.length >= MAX_PLAYROOMS}
                          style={{ marginTop: '0.35rem', padding: '0.5rem 0.9rem' }}
                        >
                          + New playroom
                        </button>
                        {playrooms.length >= MAX_PLAYROOMS && (
                          <p className="profile-hint profile-hint-compact" style={{ marginTop: '0.15rem' }}>
                            {isFreeMembership
                              ? 'Free membership includes 1 playroom — upgrade your membership to create more playrooms.'
                              : `You've used all ${MAX_PLAYROOMS} playrooms included in your membership.`}
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}
                {!editingSpace && !editingPlayroom ? (
                  <>
                    <div className="compact-section-header">
                      <label className="profile-section-label">Your spaces</label>
                      <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                        {spaces.length >= MAX_SPACES
                          ? `All ${MAX_SPACES} spaces used`
                          : `${MAX_SPACES - spaces.length} of ${MAX_SPACES} remaining`}
                      </span>
                    </div>
                    {spaces.length === 0 ? (
                      <p className="profile-hint">No spaces yet — create your first one below.</p>
                    ) : (
                      <div className="space-list">
                        {spaces.map((space, i) => (
                          <div key={space.id} className="space-row">
                            {space.logo_url ? (
                              <img src={space.logo_url} alt="" className="space-row-logo" />
                            ) : (
                              <span className="space-row-logo-fallback">
                                {(space.name || '?')[0].toUpperCase()}
                              </span>
                            )}
                            <div className="space-row-info">
                              <div className="space-row-name">{space.name}</div>
                              <div className="space-row-slug">@{profile?.username}/spaces/{space.slug}</div>
                            </div>
                            <div className="space-row-actions">
                              {confirmDeleteSpaceId === space.id ? (
                                <div className="space-confirm-actions">
                                  <span className="space-confirm-label">Delete?</span>
                                  <button
                                    type="button"
                                    className="space-confirm-btn space-confirm-danger"
                                    onClick={() => handleDeleteSpace(space.id)}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    className="space-confirm-btn"
                                    onClick={() => setConfirmDeleteSpaceId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="space-icon-button"
                                    title="Move up"
                                    disabled={i === 0}
                                    onClick={() => handleMoveSpace(space.id, -1)}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="space-icon-button"
                                    title="Move down"
                                    disabled={i === spaces.length - 1}
                                    onClick={() => handleMoveSpace(space.id, 1)}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    className="space-icon-button"
                                    title="Edit space"
                                    onClick={() => {
                                      setConfirmDeleteSpaceId(null);
                                      handleEditSpace(space);
                                    }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    className="space-icon-button space-delete"
                                    title="Delete space"
                                    onClick={() => setConfirmDeleteSpaceId(space.id)}
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="sign-in-button primary-button"
                      onClick={handleNewSpace}
                      disabled={spaces.length >= MAX_SPACES}
                      style={{ marginTop: '0.35rem', padding: '0.5rem 0.9rem' }}
                    >
                      + New space
                    </button>
                  </>
                ) : editingSpace ? (
              <>
                <div className="compact-editor-header">
                  <label className="profile-section-label">
                    {editingSpace.id ? 'Edit space' : 'New space'}
                  </label>
                  <button type="button" className="link-button" onClick={() => setEditingSpace(null)}>
                    ← Back to spaces
                  </button>
                </div>

                <div className="compact-form-stack">
                  <div className="compact-field-row">
                    <label className="compact-field-label">Name</label>
                    <input
                      type="text"
                      className="space-input"
                      value={editingSpace.name}
                      onChange={(e) => setEditingSpace({ ...editingSpace, name: e.target.value })}
                      placeholder="Cozy reads"
                      maxLength={60}
                    />
                  </div>

                  <div className="compact-field-row">
                    <label className="compact-field-label">URL</label>
                    <div className="space-slug-row">
                      <span className="space-slug-prefix">@{profile?.username}/spaces/</span>
                      <input
                        type="text"
                        className="space-input space-slug-input"
                        value={editingSpace.slug}
                        onChange={(e) => setEditingSpace({ ...editingSpace, slug: sanitizeSlugInput(e.target.value) })}
                        placeholder={slugify(editingSpace.name) || 'space-name'}
                        maxLength={50}
                      />
                    </div>
                  </div>

                  <div className="compact-field-row compact-field-row-top">
                    <label className="compact-field-label">Description</label>
                    <textarea
                      className="space-input space-description-input"
                      value={editingSpace.description}
                      onChange={(e) => setEditingSpace({ ...editingSpace, description: e.target.value })}
                      placeholder="What is this space about? (optional)"
                      maxLength={280}
                      rows={2}
                    />
                  </div>

                  <div className="compact-field-row">
                    <label className="compact-field-label">Logo</label>
                    <div className="space-logo-row">
                      {editingSpace.logoUrl ? (
                        <img src={editingSpace.logoUrl} alt="Space logo preview" className="space-logo-preview" />
                      ) : (
                        <span className="space-row-logo-fallback space-logo-preview">
                          {(editingSpace.name || '?')[0].toUpperCase()}
                        </span>
                      )}
                      <input
                        ref={spaceLogoRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleSpaceLogoPick}
                      />
                      <button
                        type="button"
                        className="sign-in-button secondary-button compact-inline-btn"
                        onClick={() => spaceLogoRef.current?.click()}
                      >
                        {editingSpace.logoUrl && !editingSpace.logoUrl.startsWith('blob:') ? 'Change logo' : 'Upload logo'}
                      </button>
                      {(editingSpace.logoUrl || editingSpace.logoFile) && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            if (editingSpace.logoUrl?.startsWith('blob:')) URL.revokeObjectURL(editingSpace.logoUrl);
                            setEditingSpace({ ...editingSpace, logoUrl: null, logoFile: null });
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {(() => {
                  const emojiInput = {
                    id: editingSpace.id,
                    name: editingSpace.name,
                    slug: editingSpace.slug,
                    description: editingSpace.description,
                    pills: editingSpace.pills,
                  };
                  const localMatches = getRankedSpaceEmojis(emojiInput, 10);
                  const rankedMatches =
                    workerEmojiMatches && workerEmojiMatches.length > 0
                      ? workerEmojiMatches
                      : localMatches;
                  const autoEmoji = rankedMatches[0]?.emoji || getAutoSpaceEmoji(emojiInput);
                  const autoLabel = rankedMatches[0]?.label || '';
                  const effectiveEmoji = (editingSpace.iconEmoji || '').trim() || autoEmoji;
                  const isOverridden = !!(editingSpace.iconEmoji && editingSpace.iconEmoji.trim());

                  const pickerGroups = getEmojiPickerGroups();
                  const q = emojiSearchQuery.trim().toLowerCase();
                  const filteredGroups = q
                    ? pickerGroups
                        .map((g) => ({
                          group: g.group,
                          items: g.items.filter(
                            (it) =>
                              it.label.toLowerCase().includes(q) ||
                              it.id.toLowerCase().includes(q) ||
                              g.group.toLowerCase().includes(q)
                          ),
                        }))
                        .filter((g) => g.items.length > 0)
                    : pickerGroups;

                  return (
                    <div className="space-emoji-section">
                      <div className="compact-field-row" style={{ marginBottom: '0.35rem' }}>
                        <label className="compact-field-label">Pin icon</label>
                        <div className="space-emoji-header-row" style={{ marginBottom: 0 }}>
                          <span className="cat-pill active space-emoji-pill-preview" aria-hidden="true">
                            <span>{effectiveEmoji}</span>
                            <span className="cat-text">{editingSpace.name.trim() || 'Your space'}</span>
                          </span>
                          <div className="space-emoji-status">
                            <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                              {isOverridden
                                ? 'Custom pin emoji'
                                : `Auto match${autoLabel ? `: ${autoLabel}` : ''}`}
                            </span>
                            {isOverridden && (
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => setEditingSpace({ ...editingSpace, iconEmoji: null })}
                              >
                                Reset ({autoEmoji})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-emoji-suggestions" role="group" aria-label="Suggested closest emojis">
                        {rankedMatches.slice(0, 8).map((match) => {
                          const selected = effectiveEmoji === match.emoji;
                          const isAutoTop = match.emoji === autoEmoji && !isOverridden;
                          return (
                            <button
                              key={match.emoji}
                              type="button"
                              className={`space-emoji-chip ${selected ? 'active' : ''}`}
                              title={`${match.label}${isAutoTop ? ' (Auto closest match)' : ''}`}
                              onClick={() =>
                                setEditingSpace({
                                  ...editingSpace,
                                  iconEmoji: match.emoji === autoEmoji ? null : match.emoji,
                                })
                              }
                            >
                              <span className="space-emoji-chip-glyph">{match.emoji}</span>
                              <span className="space-emoji-chip-label">{match.label}</span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className="space-emoji-more-btn"
                          onClick={() => setShowSpaceEmojiPicker((prev) => !prev)}
                        >
                          {showSpaceEmojiPicker ? 'Hide picker ▲' : 'More emojis… ▼'}
                        </button>
                      </div>

                      {showSpaceEmojiPicker && (
                        <div className="space-emoji-picker-drawer">
                          <div className="space-emoji-picker-controls">
                            <input
                              type="text"
                              className="space-input"
                              value={emojiSearchQuery}
                              onChange={(e) => setEmojiSearchQuery(e.target.value)}
                              placeholder="Search emojis (e.g. dinosaur, baking, ocean…)"
                            />
                            <div className="space-emoji-custom-row">
                              <input
                                type="text"
                                className="space-input space-emoji-custom-input"
                                value={customEmojiInput}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const validEmoji = extractSingleEmoji(raw, customEmojiInput);
                                  setCustomEmojiRejected(hasNonEmojiCharacters(raw));
                                  setCustomEmojiInput(validEmoji);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const validEmoji = extractSingleEmoji(customEmojiInput);
                                    if (!validEmoji) return;
                                    setEditingSpace({
                                      ...editingSpace,
                                      iconEmoji: validEmoji === autoEmoji ? null : validEmoji,
                                    });
                                    setCustomEmojiInput('');
                                    setCustomEmojiRejected(false);
                                  }
                                }}
                                placeholder="Or paste/type an emoji (e.g. 🦊)…"
                                aria-label="Custom emoji"
                              />
                              <button
                                type="button"
                                className="sign-in-button secondary-button"
                                disabled={!extractSingleEmoji(customEmojiInput)}
                                onClick={() => {
                                  const validEmoji = extractSingleEmoji(customEmojiInput);
                                  if (!validEmoji) return;
                                  setEditingSpace({
                                    ...editingSpace,
                                    iconEmoji: validEmoji === autoEmoji ? null : validEmoji,
                                  });
                                  setCustomEmojiInput('');
                                  setCustomEmojiRejected(false);
                                }}
                              >
                                Use {extractSingleEmoji(customEmojiInput) || 'emoji'}
                              </button>
                            </div>
                            {customEmojiRejected && (
                              <p className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                                Emojis only — plain text isn't allowed for pin icons.
                              </p>
                            )}
                          </div>
                          <div className="space-emoji-groups-scroll">
                            {filteredGroups.map((group) => (
                              <div key={group.group} className="space-emoji-group">
                                <div className="space-emoji-group-title">{group.group}</div>
                                <div className="space-emoji-grid">
                                  {group.items.map((item) => {
                                    const selected = effectiveEmoji === item.emoji;
                                    return (
                                      <button
                                        key={`${group.group}-${item.emoji}`}
                                        type="button"
                                        className={`space-emoji-grid-btn ${selected ? 'active' : ''}`}
                                        title={item.label}
                                        onClick={() =>
                                          setEditingSpace({
                                            ...editingSpace,
                                            iconEmoji: item.emoji === autoEmoji ? null : item.emoji,
                                          })
                                        }
                                      >
                                        {item.emoji}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {filteredGroups.length === 0 && (
                              <p className="profile-hint profile-hint-compact">
                                No matching emojis found — try pasting any emoji above!
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="compact-section-header" style={{ marginTop: '0.2rem' }}>
                  <label className="profile-field-label">Interests in this space</label>
                  <span className="profile-hint profile-hint-compact" style={{ margin: 0 }}>
                    {editingSpace.pills.length} selected
                  </span>
                </div>
                <div className="space-interests-panel">
                  <div className="space-pill-picker" style={{ margin: 0 }}>
                    {CATEGORIES.map((cat) => {
                      const pill: PillConfig = { id: cat.id, type: 'category' };
                      const checked = editingSpace.pills.some(
                        (p) => p.type === 'category' && p.id === cat.id
                      );
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={`pill-toggle ${checked ? 'active' : ''}`}
                          onClick={() => handleSpacePillToggle(pill)}
                        >
                          <span>{cat.icon}</span> {t(cat.i18nKey as keyof TranslationStrings) || cat.id}
                        </button>
                      );
                    })}
                  </div>
                  {INTEREST_KEYWORD_GROUPS.map((group: string) => {
                    const groupKeywords = INTEREST_KEYWORDS.filter((kw) => kw.group === group);
                    const selectedInGroup = groupKeywords.filter((kw) =>
                      editingSpace.pills.some((p) => p.type === 'keyword' && p.id === kw.id)
                    ).length;
                    return (
                      <details
                        key={group}
                        className="space-interest-group"
                      >
                        <summary className="space-interest-group-summary">
                          <span>{group}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            {selectedInGroup > 0 && (
                              <span className="space-interest-group-badge">{selectedInGroup}</span>
                            )}
                            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▾</span>
                          </span>
                        </summary>
                        <div className="space-pill-picker">
                          {groupKeywords.map((kw) => {
                            const pill: PillConfig = { id: kw.id, type: 'keyword' };
                            const checked = editingSpace.pills.some(
                              (p) => p.type === 'keyword' && p.id === kw.id
                            );
                            return (
                              <button
                                key={kw.id}
                                type="button"
                                className={`pill-toggle ${checked ? 'active' : ''}`}
                                onClick={() => handleSpacePillToggle(pill)}
                              >
                                <span>{kw.icon}</span> {kw.label}
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
                {editingSpace.pills.filter((p) => p.type === 'custom').length > 0 && (
                  <div className="space-custom-pills">
                    {editingSpace.pills
                      .filter((p) => p.type === 'custom')
                      .map((pill) => (
                        <span key={pill.id} className="space-custom-pill">
                          {getPillEmoji(pill)} {pill.label || pill.id}
                          <button
                            type="button"
                            className="pill-remove"
                            onClick={() => handleSpacePillToggle(pill)}
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
                <div className="compact-field-row">
                  <label className="compact-field-label">Custom</label>
                  <div className="space-custom-pill-row" style={{ marginBottom: 0 }}>
                    <input
                      type="text"
                      className="space-input"
                      value={newPillLabel}
                      onChange={(e) => setNewPillLabel(e.target.value)}
                      placeholder="Add a custom interest…"
                      maxLength={40}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomSpacePill();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="sign-in-button secondary-button"
                      onClick={addCustomSpacePill}
                      disabled={!newPillLabel.trim()}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-editor-actions">
                  <button
                    type="button"
                    className="sign-in-button secondary-button"
                    onClick={() => setEditingSpace(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sign-in-button primary-button"
                    onClick={handleSaveSpace}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : editingSpace.id ? 'Save' : 'Create space'}
                  </button>
                  {editingSpace.id && (
                    confirmDeleteSpaceId === editingSpace.id ? (
                      <div className="space-confirm-actions">
                        <span className="space-confirm-label">Delete "{editingSpace.name}"?</span>
                        <button
                          type="button"
                          className="space-confirm-btn space-confirm-danger"
                          onClick={() => handleDeleteSpace(editingSpace.id as string)}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          className="space-confirm-btn"
                          onClick={() => setConfirmDeleteSpaceId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="sign-in-button secondary-button space-delete-button"
                        onClick={() => setConfirmDeleteSpaceId(editingSpace.id as string)}
                      >
                        Delete
                      </button>
                    )
                  )}
                </div>
              </>
            ) : null}
              </>
            )}
          </div>
        )}

        <div className="profile-footer">
          <button
            type="button"
            className="sign-in-button primary-button"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save all'}
          </button>
          <button
            type="button"
            className="sign-in-button secondary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
