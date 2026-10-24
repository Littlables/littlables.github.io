import React, { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Profile, useAuth } from '../contexts/AuthContext';
import {
  Playroom,
  getPlayroomBySlug,
  getPlayroomSpaces,
} from '../services/playroomService';
import type { Board } from '../services/boardService';
import { fetchPlayroomFeed } from '../services/playroomFeedService';
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
}

const VALID_THEMES = ['dark', 'dark-purple', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

export const PlayroomPage: React.FC<PlayroomPageProps> = ({
  username,
  slug,
  onHome,
}) => {
  const { profile: viewerProfile } = useAuth();
  const [playroom, setPlayroom] = useState<Playroom | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Board[]>([]);
  const [stories, setStories] = useState<NewsItem[]>([]);
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // When a space pill is tapped, filter the feed to that space (tap again to clear)
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

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

  // Fetch stories via the backend /api/playroom endpoint.
  // When a space pill is active, the backend filters to that space's interests.
  useEffect(() => {
    if (!playroom) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const feed = await fetchPlayroomFeed(playroom.id, activeSpaceId);
        if (cancelled) return;
        // Backend returns approved-first, date-sorted, deduped.
        setStories(feed.items);
        if (feed.items.length > 0) {
          try {
            const data = await fetchReactionsForStories(
              feed.items.map((s) => getStoryId(s.title, s.link))
            );
            if (!cancelled) setReactions(data);
          } catch {
            /* reactions are best-effort */
          }
        }
      } catch {
        if (!cancelled) setStories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playroom, activeSpaceId]);

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
                className={`cat-pill${activeSpaceId === space.id ? ' active' : ''}`}
                onClick={() => setActiveSpaceId((prev) => (prev === space.id ? null : space.id))}
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
