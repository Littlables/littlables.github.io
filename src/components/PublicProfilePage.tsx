import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Profile } from '../contexts/AuthContext';
import { Board, getUserBoards } from '../services/boardService';
import { Playroom, getUserPlayrooms, getPlayroomSpaces } from '../services/playroomService';
import { getCharacterAvatar } from '../constants/avatars';

interface PublicProfilePageProps {
  username: string;
  onHome: () => void;
}

const VALID_THEMES = ['dark', 'dark-purple', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

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
}) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [playrooms, setPlayrooms] = useState<Playroom[]>([]);
  const [playroomSpaceCounts, setPlayroomSpaceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch the public profile by username
  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const client = getSupabaseClient();
        if (!client) {
          if (!cancelled) setNotFound(true);
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
        } else {
          setProfile(data as Profile);
          // Load the user's boards (public, in display order)
          getUserBoards((data as Profile).id)
            .then((b) => {
              if (!cancelled) setBoards(b);
            })
            .catch(() => {});
          // Load the user's playrooms + space counts (public)
          getUserPlayrooms((data as Profile).id)
            .then(async (rooms) => {
              if (cancelled) return;
              setPlayrooms(rooms);
              const counts: Record<string, number> = {};
              await Promise.all(
                rooms.map(async (r) => {
                  try {
                    counts[r.id] = (await getPlayroomSpaces(r.id)).length;
                  } catch {
                    counts[r.id] = 0;
                  }
                })
              );
              if (!cancelled) setPlayroomSpaceCounts(counts);
            })
            .catch(() => {});
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [username]);

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
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={normalizeUrl(profile.social_links[s.key]!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="space-social-link"
                    title={s.label}
                  >
                    <span aria-hidden="true">{s.icon}</span> {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {playrooms.length > 0 && (
            <div className="space-boards-section">
              <h2 className="space-section-title">🛝 Playrooms</h2>
              <div className="space-boards">
                {playrooms.map((playroom) => (
                  <button
                    key={playroom.id}
                    type="button"
                    className="space-board-card"
                    onClick={() => {
                      window.history.pushState({}, '', `/@${profile.username}/${playroom.slug}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                  >
                    {playroom.logo_url ? (
                      <img src={playroom.logo_url} alt="" className="space-board-logo" />
                    ) : (
                      <span className="space-board-logo-fallback">
                        {(playroom.name || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="space-board-info">
                      <span className="space-board-name">{playroom.name}</span>
                      {playroom.description && (
                        <span className="space-board-description">{playroom.description}</span>
                      )}
                      <span className="space-board-meta">
                        {playroomSpaceCounts[playroom.id] ?? 0} spaces · /{playroom.slug}
                      </span>
                    </span>
                    <span className="space-board-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {boards.length > 0 && (
            <div className="space-boards-section">
              <h2 className="space-section-title">🏖️ Spaces</h2>
              <div className="space-boards">
                {boards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    className="space-board-card"
                    onClick={() => {
                      window.history.pushState({}, '', `/@${profile.username}/spaces/${board.slug}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }}
                  >
                    {board.logo_url ? (
                      <img src={board.logo_url} alt="" className="space-board-logo" />
                    ) : (
                      <span className="space-board-logo-fallback">
                        {(board.name || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="space-board-info">
                      <span className="space-board-name">{board.name}</span>
                      {board.description && (
                        <span className="space-board-description">{board.description}</span>
                      )}
                      <span className="space-board-meta">
                        {board.pills?.length || 0} topics · /spaces/{board.slug}
                      </span>
                    </span>
                    <span className="space-board-arrow" aria-hidden="true">→</span>
                  </button>
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
