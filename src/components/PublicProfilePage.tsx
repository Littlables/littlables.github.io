import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Profile, useAuth } from '../contexts/AuthContext';
import { Space, getUserSpaces } from '../services/spaceService';
import { Playroom, getUserPlayrooms, getPlayroomSpacesMap } from '../services/playroomService';
import { getCharacterAvatar } from '../constants/avatars';
import { SITE_TITLE_BASE } from '../constants/config';
import { trackExitPage } from '../services/trackingService';
import type { OpenProfileTarget } from './PlayroomPage';

interface PublicProfilePageProps {
  username: string;
  onHome: () => void;
  onOpenProfile?: (target?: OpenProfileTarget) => void;
}

const VALID_THEMES = ['dark-purple', 'dark', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

const SOCIAL_META: { key: keyof Profile['social_links']; label: string; icon: string }[] = [
  { key: 'twitter', label: 'Twitter / X', icon: '𝕏' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵' },
  { key: 'youtube', label: 'YouTube', icon: '▶️' },
  { key: 'website', label: 'Website', icon: '🔗' },
];

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({
  username,
  onHome,
  onOpenProfile,
}) => {
  const { user, profile: viewerProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(() =>
    viewerProfile?.username?.toLowerCase() === username.toLowerCase() ? viewerProfile : null
  );
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [playrooms, setPlayrooms] = useState<Playroom[]>([]);
  const [playroomSpacesMap, setPlayroomSpacesMap] = useState<Record<string, Space[]>>({});
  const [playroomSpaceCounts, setPlayroomSpaceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchPlayroomsBundle = useCallback(async (profileId: string) => {
    const rooms = await getUserPlayrooms(profileId);
    const spacesMap = await getPlayroomSpacesMap(rooms.map((r) => r.id));
    const counts: Record<string, number> = {};
    for (const r of rooms) {
      counts[r.id] = (spacesMap[r.id] || []).length;
    }
    return { rooms, spacesMap, counts };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchProfileAndCollections = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const client = getSupabaseClient();
        if (!client) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const isViewingOwnCachedProfile =
          !!viewerProfile && viewerProfile.username?.toLowerCase() === username.toLowerCase();

        if (isViewingOwnCachedProfile && viewerProfile) {
          // Fast path: we already know the profile ID, so fetch profile refresh, spaces,
          // and playrooms + space counts in parallel without a waterfall!
          const [freshProfileRes, loadedSpaces, playroomsBundle] = await Promise.all([
            client
              .from('profiles')
              .select('*')
              .eq('id', viewerProfile.id)
              .maybeSingle(),
            getUserSpaces(viewerProfile.id).catch(() => [] as Space[]),
            fetchPlayroomsBundle(viewerProfile.id).catch(() => ({
              rooms: [] as Playroom[],
              spacesMap: {} as Record<string, Space[]>,
              counts: {} as Record<string, number>,
            })),
          ]);
          if (cancelled) return;
          const resolvedProfile = (freshProfileRes.data as Profile | null) || viewerProfile;
          setProfile(resolvedProfile);
          setSpaces(loadedSpaces);
          setPlayrooms(playroomsBundle.rooms);
          setPlayroomSpacesMap(playroomsBundle.spacesMap);
          setPlayroomSpaceCounts(playroomsBundle.counts);
          return;
        }

        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('username', username.toLowerCase())
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setNotFound(true);
          return;
        }

        const loadedProfile = data as Profile;
        // Fetch spaces and playrooms + space counts in parallel before releasing loading
        // so the entire profile page renders in one frame without sections popping in.
        const [loadedSpaces, playroomsBundle] = await Promise.all([
          getUserSpaces(loadedProfile.id).catch(() => [] as Space[]),
          fetchPlayroomsBundle(loadedProfile.id).catch(() => ({
            rooms: [] as Playroom[],
            spacesMap: {} as Record<string, Space[]>,
            counts: {} as Record<string, number>,
          })),
        ]);
        if (cancelled) return;

        setProfile(loadedProfile);
        setSpaces(loadedSpaces);
        setPlayrooms(playroomsBundle.rooms);
        setPlayroomSpacesMap(playroomsBundle.spacesMap);
        setPlayroomSpaceCounts(playroomsBundle.counts);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfileAndCollections();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, fetchPlayroomsBundle]);

  // Keep own profile in sync when edited in ProfileDialog
  useEffect(() => {
    if (viewerProfile && profile && viewerProfile.id === profile.id) {
      setProfile(viewerProfile);
    }
  }, [viewerProfile, profile]);

  // Refresh playrooms and spaces when the profile dialog saves changes
  useEffect(() => {
    const onPlayroomsChanged = () => {
      if (!profile) return;
      fetchPlayroomsBundle(profile.id)
        .then((bundle) => {
          setPlayrooms(bundle.rooms);
          setPlayroomSpacesMap(bundle.spacesMap);
          setPlayroomSpaceCounts(bundle.counts);
        })
        .catch(() => {});
    };
    const onSpacesChanged = () => {
      if (!profile) return;
      getUserSpaces(profile.id)
        .then((s) => setSpaces(s))
        .catch(() => {});
    };
    window.addEventListener('littlables:playrooms-changed', onPlayroomsChanged);
    window.addEventListener('littlables:spaces-changed', onSpacesChanged);
    return () => {
      window.removeEventListener('littlables:playrooms-changed', onPlayroomsChanged);
      window.removeEventListener('littlables:spaces-changed', onSpacesChanged);
    };
  }, [profile, fetchPlayroomsBundle]);

  // Browser tab title: base + display name (or @username) once the profile loads
  useEffect(() => {
    document.title = profile
      ? `${SITE_TITLE_BASE} | ${profile.display_name || `@${profile.username}`}`
      : SITE_TITLE_BASE;
  }, [profile]);

  // Apply the space owner's theme + background color, restore on unmount
  useEffect(() => {
    if (!profile) return;
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');
    const prevBgVar = root.style.getPropertyValue('--news-bg');

    if (profile.theme && VALID_THEMES.includes(profile.theme)) {
      root.setAttribute('data-theme', profile.theme);
    }
    if (profile.background_color && /^#[0-9a-fA-F]{6}$/.test(profile.background_color)) {
      root.style.setProperty('--news-bg', profile.background_color);
    }

    return () => {
      if (prevTheme) root.setAttribute('data-theme', prevTheme);
      if (prevBgVar) {
        root.style.setProperty('--news-bg', prevBgVar);
      } else {
        root.style.removeProperty('--news-bg');
      }
    };
  }, [profile?.theme, profile?.background_color]);

  const character = getCharacterAvatar(profile?.avatar_character);
  const socials = SOCIAL_META.filter(
    (s) => profile?.social_links?.[s.key]?.trim()
  );
  const isOwner = !!user && !!profile && user.id === profile.id;

  const renderAvatar = (size: number) => {
    if (profile?.avatar_url) {
      return (
        <img
          src={profile.avatar_url}
          alt={profile.display_name || username}
          className="space-avatar-img"
          style={{ width: size, height: size }}
        />
      );
    }
    if (profile?.avatar_type === 'character' && character) {
      return (
        <span
          className="space-avatar-character"
          style={{ width: size, height: size, background: character.bg, fontSize: size * 0.66 }}
          role="img"
          aria-label={character.name}
        >
          <span className="avatar-emoji-glyph">{character.emoji}</span>
        </span>
      );
    }
    const initial = (profile?.display_name || username || '?')[0].toUpperCase();
    return (
      <span
        className="space-avatar-initial"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {initial}
      </span>
    );
  };

  return (
    <main className="space-page">
      {loading ? (
        <div className="news-loading-skeleton" role="status">
          Loading this space…
        </div>
      ) : notFound || !profile ? (
        <div className="news-feed-error" role="status">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛸</div>
          <p>
            <strong>@{username}</strong> doesn't have a space here yet.
          </p>
          <button
            className="refresh-news-button"
            style={{ marginTop: '0.75rem' }}
            onClick={onHome}
          >
            ← Back to Littlables
          </button>
        </div>
      ) : (
        <div className="space-card">
          <div className="space-hero">
            {renderAvatar(96)}
            <h1 className="space-display-name">
              {profile.display_name || `@${profile.username}`}
            </h1>
            <p className="space-username">@{profile.username}</p>
            {profile.bio && <p className="space-bio">{profile.bio}</p>}
            {socials.length > 0 && (
              <div className="space-socials">
                {socials.map((s) => {
                  const href = normalizeUrl(profile.social_links[s.key]!);
                  return (
                    <a
                      key={s.key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="space-social-link"
                      title={s.label}
                      data-umami-event="Clicked-Social-Link"
                      data-umami-event-platform={s.key}
                      onClick={() => trackExitPage(href, `${s.label} | @${profile.username}`)}
                    >
                      <span aria-hidden="true">{s.icon}</span> {s.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {playrooms.length > 0 && (
            <div className="space-collections-section">
              <h2 className="space-section-title">Playrooms</h2>
              <div className="space-collections">
                {playrooms.map((playroom) => (
                  <div
                    key={playroom.id}
                    role="button"
                    tabIndex={0}
                    className="space-collection-card"
                    data-umami-event="Open-Playroom"
                    data-umami-event-playroom={`@${profile.username}/${playroom.slug}`}
                    onClick={() => {
                      window.history.pushState({}, '', `/@${profile.username}/${playroom.slug}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        window.history.pushState({}, '', `/@${profile.username}/${playroom.slug}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }
                    }}
                  >
                    {playroom.logo_url ? (
                      <img src={playroom.logo_url} alt="" className="space-collection-logo" />
                    ) : (
                      <span className="space-collection-logo-fallback">
                        {(playroom.name || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="space-collection-info">
                      <span className="space-collection-name">{playroom.name}</span>
                      {playroom.description && (
                        <span className="space-collection-description">{playroom.description}</span>
                      )}
                      <span className="space-collection-meta">
                        {playroomSpaceCounts[playroom.id] ?? 0} spaces · /{playroom.slug}
                      </span>
                    </span>
                    {isOwner && onOpenProfile && (
                      <button
                        type="button"
                        className="space-icon-button space-collection-edit-btn"
                        title="Edit playroom"
                        aria-label={`Edit ${playroom.name}`}
                        data-umami-event="Edit-Playroom"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile({
                            tab: 'playrooms',
                            playroomId: playroom.id,
                            playroom,
                            playroomSpaces: playroomSpacesMap[playroom.id] || [],
                          });
                        }}
                      >
                        ✏️
                      </button>
                    )}
                    <span className="space-collection-arrow" aria-hidden="true">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {spaces.length > 0 && (
            <div className="space-collections-section">
              <h2 className="space-section-title">Spaces</h2>
              <div className="space-collections">
                {spaces.map((space) => (
                  <div
                    key={space.id}
                    role="button"
                    tabIndex={0}
                    className="space-collection-card"
                    data-umami-event="Open-Space"
                    data-umami-event-space={`@${profile.username}/spaces/${space.slug}`}
                    onClick={() => {
                      window.history.pushState({}, '', `/@${profile.username}/spaces/${space.slug}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        window.history.pushState({}, '', `/@${profile.username}/spaces/${space.slug}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }
                    }}
                  >
                    {space.logo_url ? (
                      <img src={space.logo_url} alt="" className="space-collection-logo" />
                    ) : (
                      <span className="space-collection-logo-fallback">
                        {(space.name || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="space-collection-info">
                      <span className="space-collection-name">{space.name}</span>
                      {space.description && (
                        <span className="space-collection-description">{space.description}</span>
                      )}
                      <span className="space-collection-meta">
                        {space.pills?.length || 0} topics · /spaces/{space.slug}
                      </span>
                    </span>
                    {isOwner && onOpenProfile && (
                      <button
                        type="button"
                        className="space-icon-button space-collection-edit-btn"
                        title="Edit space"
                        aria-label={`Edit ${space.name}`}
                        data-umami-event="Edit-Space"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile({
                            tab: 'playrooms',
                            spaceId: space.id,
                            space,
                          });
                        }}
                      >
                        ✏️
                      </button>
                    )}
                    <span className="space-collection-arrow" aria-hidden="true">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default PublicProfilePage;
