import React, { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Profile, useAuth, type PillConfig } from '../contexts/AuthContext';
import {
  Playroom,
  getPlayroomBySlug,
  getPlayroomSpaces,
} from '../services/playroomService';
import type { Board } from '../services/boardService';
import { fetchNewsFeed, fetchKeywordFeed } from '../services/newsService';
import {
  fetchReactionsForStories,
  toggleStoryReaction,
  getStoryId,
} from '../services/supabaseService';
import { NewsCard } from './NewsCard';
import { t } from '../constants/translations';
import type { NewsItem, NewsCategory, ReactionCounts, ReactionType } from '../types';

interface PlayroomPageProps {
  username: string;
  slug: string;
  onHome: () => void;
  onBrand: (brand: { name: string; logoUrl: string | null } | null) => void;
}

const VALID_THEMES = ['dark', 'dark-purple', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

export const PlayroomPage: React.FC<PlayroomPageProps> = ({
  username,
  slug,
  onHome,
  onBrand,
}) => {
  const { profile: viewerProfile } = useAuth();
  const [playroom, setPlayroom] = useState<Playroom | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Board[]>([]);
  const [stories, setStories] = useState<NewsItem[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch the playroom + its owner + its spaces
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setPlayroom(null);
      setSpaces([]);
      try {
        const result = await getPlayroomBySlug(username, slug);
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setPlayroom(result.playroom);
        onBrand({ name: result.playroom.name, logoUrl: result.playroom.logo_url });
        const client = getSupabaseClient();
        if (client) {
          const { data: ownerProfile } = await client
            .from('profiles')
            .select('*')
            .eq('id', result.ownerId)
            .maybeSingle();
          if (!cancelled && ownerProfile) setOwner(ownerProfile as Profile);
        }
        const playroomSpaces = await getPlayroomSpaces(result.playroom.id);
        if (!cancelled) setSpaces(playroomSpaces);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      onBrand(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, slug]);

  // Apply the playroom's theme + background (falling back to the owner's), restore on unmount.
  useEffect(() => {
    if (!playroom) return;
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');
    const prevBg = root.style.getPropertyValue('--news-bg');
    const useViewerTheme = viewerProfile?.use_viewer_theme_for_boards === true;
    const theme = useViewerTheme ? null : (playroom.theme === 'none' ? null : (playroom.theme || owner?.theme));
    const bg = useViewerTheme ? null : (playroom.background_color || owner?.background_color);
    if (theme && VALID_THEMES.includes(theme)) root.setAttribute('data-theme', theme);
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) root.style.setProperty('--news-bg', bg);
    return () => {
      if (prevTheme) root.setAttribute('data-theme', prevTheme);
      if (prevBg) root.style.setProperty('--news-bg', prevBg);
      else root.style.removeProperty('--news-bg');
    };
  }, [playroom, owner, viewerProfile?.use_viewer_theme_for_boards]);

  // Fetch stories for every space's pills, merged + deduped into one combined feed
  useEffect(() => {
    if (!playroom || spaces.length === 0) {
      if (playroom) setStories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // Collect unique pills across all spaces (dedupe by type+id)
      const seenPills = new Map<string, PillConfig>();
      for (const space of spaces) {
        for (const p of space.pills || []) {
          const key = `${p.type}:${p.id}`;
          if (!seenPills.has(key)) seenPills.set(key, p);
        }
      }
      const pills = [...seenPills.values()];
      if (pills.length === 0) {
        setStories([]);
        return;
      }
      const results = await Promise.allSettled(
        pills.map((p) =>
          p.type === 'keyword'
            ? fetchKeywordFeed(p.id)
            : fetchNewsFeed(
                (p.type === 'custom' ? p.keywords || p.label || p.id : p.id) as NewsCategory
              )
        )
      );
      if (cancelled) return;
      const seen = new Set<string>();
      const merged: NewsItem[] = [];
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const s of r.value) {
          const key = `${s.link || ''}|${s.title || ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(s);
        }
      }
      merged.sort(
        (a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
      );
      setStories(merged);
      if (merged.length > 0) {
        try {
          const data = await fetchReactionsForStories(
            merged.map((s) => getStoryId(s.title, s.link))
          );
          if (!cancelled) setReactions(data);
        } catch {
          /* reactions are best-effort */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playroom, spaces]);

  const handleReaction = useCallback(async (storyId: string, type: ReactionType) => {
    setReactions((prev) => {
      const current = prev[storyId] || { love: 0, mind: 0, cozy: 0 };
      return { ...prev, [storyId]: { ...current, [type]: Number(current[type] || 0) + 1 } };
    });
    try {
      const result = await toggleStoryReaction(storyId, type);
      if (result.success && result.newCount != null) {
        setReactions((prev) => ({
          ...prev,
          [storyId]: { ...(prev[storyId] || { love: 0, mind: 0, cozy: 0 }), [type]: result.newCount as number },
        }));
      }
    } catch {
      /* optimistic update stands */
    }
  }, []);

  const handleOpenStory = useCallback((item: NewsItem) => {
    if (item.link) window.open(item.link, '_blank', 'noopener');
  }, []);

  if (loading) {
    return (
      <main className="news-grid">
        <div className="news-loading-skeleton" role="status">
          {t('loading') || 'Fetching the freshest stories...'}
        </div>
      </main>
    );
  }

  if (notFound || !playroom) {
    return (
      <main className="news-grid">
        <div className="space-not-found">
          <div className="space-not-found-emoji">🛝</div>
          <h2>This playroom doesn't exist yet</h2>
          <p>
            @{username}'s <strong>/{slug}</strong> playroom couldn't be found. It may have been
            renamed or removed.
          </p>
          <button type="button" className="sign-in-button primary-button" onClick={onHome}>
            Back to Littlables
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="news-grid-container" className="news-grid">
      <div className="board-page-header">
        {playroom.logo_url ? (
          <img src={playroom.logo_url} alt={`${playroom.name} logo`} className="board-page-logo" />
        ) : (
          <div className="board-page-logo-fallback">{(playroom.name || '?')[0].toUpperCase()}</div>
        )}
        <div>
          <h1 className="board-page-title">{playroom.name}</h1>
          <div className="board-page-owner">
            by{' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                window.history.pushState({}, '', `/@${username}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              @{username}
            </button>
          </div>
          {playroom.description && <p className="board-page-description">{playroom.description}</p>}
        </div>
      </div>

      {spaces.length > 0 && (
        <div className="news-category-container playroom-space-pills">
          <nav className="news-category-bar" aria-label="Spaces in this playroom">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                className="cat-pill"
                onClick={() => {
                  window.history.pushState({}, '', `/@${username}/${playroom.slug}/${space.slug}`);
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                {space.logo_url ? (
                  <img src={space.logo_url} alt="" className="playroom-space-pill-logo" />
                ) : null}
                <span className="cat-text">{space.name}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {stories.length === 0 ? (
        <div className="board-empty">
          <p>
            {spaces.length === 0
              ? 'This playroom has no spaces yet.'
              : 'No fresh stories on these topics right now — check back soon.'}
          </p>
        </div>
      ) : (
        stories.map((story, index) => {
          const storyId = getStoryId(story.title, story.link);
          const cardReactions = reactions[storyId] || { love: 0, mind: 0, cozy: 0 };
          return (
            <NewsCard
              key={`${story.link}-${index}`}
              item={story}
              index={index}
              category={(story.category as NewsCategory) || 'all'}
              categoryBadge={story.category || ''}
              reactions={cardReactions}
              onReact={handleReaction}
              onOpenStory={handleOpenStory}
            />
          );
        })
      )}
    </main>
  );
};

export default PlayroomPage;
