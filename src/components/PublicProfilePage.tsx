import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Profile, useAuth } from '../contexts/AuthContext';
import { getCharacterAvatar } from '../constants/avatars';
import { CATEGORIES } from '../constants/config';
import { t } from '../constants/translations';

interface PublicProfilePageProps {
  username: string;
  onHome: () => void;
  onOpenProfile: () => void;
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

function pillLabel(pill: NonNullable<Profile['pills']>[number]): { icon: string; label: string } {
  if (pill.type === 'custom') {
    return { icon: '🏷️', label: pill.label || pill.id };
  }
  const cat = CATEGORIES.find((c) => c.id === pill.id);
  return {
    icon: cat?.icon || '📰',
    label: cat ? t(cat.i18nKey as keyof typeof t) || pill.id : pill.id,
  };
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({
  username,
  onHome,
  onOpenProfile,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
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

  const isOwner = !!user && !!profile && user.id === profile.id;
  const character = getCharacterAvatar(profile?.avatar_character);
  const pills = profile?.pills && profile.pills.length > 0 ? profile.pills : null;
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
          style={{ width: size, height: size, background: character.bg, fontSize: size * 0.55 }}
          role="img"
          aria-label={character.name}
        >
          {character.emoji}
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
            {isOwner && (
              <button className="refresh-news-button" onClick={onOpenProfile}>
                ✏️ Edit your space
              </button>
            )}
          </div>

          {pills && (
            <div className="space-pills-section">
              <h2 className="space-section-title">📌 {(profile.display_name || `@${profile.username}`)}'s board</h2>
              <div className="space-pills">
                {pills.map((pill) => {
                  const { icon, label } = pillLabel(pill);
                  return (
                    <span key={pill.id} className="space-pill">
                      <span aria-hidden="true">{icon}</span> {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default PublicProfilePage;
