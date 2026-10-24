import React, { useEffect, useState, useCallback } from 'react';
import { getSupabaseClient } from '../services/supabaseService';
import { Profile, useAuth } from '../contexts/AuthContext';
import { Board, getBoardBySlug } from '../services/boardService';
import { Playroom, getPlayroomBySlug } from '../services/playroomService';
import { fetchInterestFeed } from '../services/playroomFeedService';
import { AdCard } from './AdCard';
import { fetchAdsForCategory, fetchMatchedAdIds } from '../services/adsService';
import {
  fetchReactionsForStories,
  toggleStoryReaction,
  getStoryId,
} from '../services/supabaseService';
import { NewsCard } from './NewsCard';
import { t } from '../constants/translations';
import { INTEREST_KEYWORDS } from '../constants/interestKeywords';
import type { NewsItem, NewsCategory, ReactionCounts, ReactionType, AdItem } from '../types';

// Map interest ID → label for badge display
const INTEREST_LABELS = new Map(INTEREST_KEYWORDS.map(k => [k.id, k.label]));

// Get the best (highest-confidence) interest label for a story
function getBestInterestLabel(story: NewsItem): string | null {
  const keywords = story.interestKeywords;
  if (!keywords || keywords.length === 0) return null;
  return INTEREST_LABELS.get(keywords[0]) || keywords[0];
}

interface BoardPageProps {
  username: string;
  slug: string;
  /** When set, the space is viewed inside this playroom: its theme applies + a back link shows. */
  playroomSlug?: string;
  onHome: () => void;
  onOpenProfile: () => void;
}

const VALID_THEMES = ['dark', 'dark-purple', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

export const BoardPage: React.FC<BoardPageProps> = ({
  username,
  slug,
  playroomSlug,
  onHome,
  onOpenProfile,
}) => {
  const { user, profile: viewerProfile } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [playroom, setPlayroom] = useState<Playroom | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [stories, setStories] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [storyAds, setStoryAds] = useState<Record<number, AdItem>>({});
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch the board + its owner (+ the playroom when in playroom context)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setBoard(null);
      setPlayroom(null);
      try {
        const result = await getBoardBySlug(username, slug);
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setBoard(result.board);
        const client = getSupabaseClient();
        if (client) {
          const { data: ownerProfile } = await client
            .from('profiles')
            .select('*')
            .eq('id', result.ownerId)
            .maybeSingle();
          if (!cancelled && ownerProfile) setOwner(ownerProfile as Profile);
        }
        if (playroomSlug) {
          const pr = await getPlayroomBySlug(username, playroomSlug);
          if (!cancelled && pr) setPlayroom(pr.playroom);
        }
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
  }, [username, slug, playroomSlug]);

  // Apply the theme + background, restore on unmount.
  // In playroom context the playroom's theme wins (spaces are themeless feeds);
  // otherwise the board's theme, falling back to the owner's.
  // A theme of 'none' means: use whatever theme the viewer has selected.
  // If the viewer has enabled "always use my theme", skip theming entirely.
  useEffect(() => {
    if (!board) return;
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');
    const prevBg = root.style.getPropertyValue('--news-bg');
    const useViewerTheme = viewerProfile?.use_viewer_theme_for_boards === true;
    const themeSource = playroomSlug ? playroom : board;
    const theme = useViewerTheme ? null : (themeSource?.theme === 'none' ? null : (themeSource?.theme || owner?.theme));
    const bg = useViewerTheme ? null : ((playroomSlug ? playroom?.background_color : board.background_color) || owner?.background_color);
    if (theme && VALID_THEMES.includes(theme)) root.setAttribute('data-theme', theme);
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) root.style.setProperty('--news-bg', bg);
    return () => {
      if (prevTheme) root.setAttribute('data-theme', prevTheme);
      if (prevBg) root.style.setProperty('--news-bg', prevBg);
      else root.style.removeProperty('--news-bg');
    };
  }, [board, playroom, owner, playroomSlug, viewerProfile?.use_viewer_theme_for_boards]);

  // Fetch stories for the board's pills, merged + deduped
  useEffect(() => {
    if (!board) return;
    let cancelled = false;
    (async () => {
      const pills = board.pills && board.pills.length > 0 ? board.pills : [];
      if (pills.length === 0) {
        setStories([]);
        return;
      }
      // Collect interest IDs from pills; backend resolves categories vs keywords
      const interestIds: string[] = [];
      for (const p of pills) {
        if (p.type === 'category') {
          interestIds.push(p.id);
        } else if (p.type === 'keyword') {
          interestIds.push(p.id);
        } else if (p.type === 'custom') {
          const kws = (p.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean);
          if (kws.length > 0) interestIds.push(...kws);
          else if (p.label) interestIds.push(p.label.toLowerCase());
        } else {
          interestIds.push(p.id);
        }
      }
      try {
        const feed = await fetchInterestFeed(interestIds);
        if (cancelled) return;
        // Backend returns approved-first, date-sorted, deduped.
        setStories(feed.items);
        // Fetch ads and keyword-match them to every 3rd story
        try {
          const fetchedAds = await fetchAdsForCategory('all');
          if (!cancelled) setAds(fetchedAds);
          const adSlotStories = feed.items
            .map((story, index) => ({ story, index }))
            .filter(({ index }) => (index + 1) % 3 === 0)
            .map(({ story, index }) => ({ ...(story as any), _index: index }));
          if (adSlotStories.length > 0) {
            const matches = await fetchMatchedAdIds(adSlotStories as any);
            const adById = new Map<string, AdItem>();
            for (const ad of fetchedAds) {
              if (ad.id) adById.set(ad.id, ad);
            }
            const matched: Record<number, AdItem> = {};
            for (const { index } of adSlotStories.map(s => ({ index: (s as any)._index }))) {
              const adIds = matches[index] || [];
              if (adIds.length > 0) {
                const slot = Math.floor(index / 3);
                const adId = adIds[slot % adIds.length];
                const ad = adById.get(adId);
                if (ad) matched[index] = ad;
              }
            }
            if (!cancelled) setStoryAds(matched);
          }
        } catch {
          /* ads are best-effort */
        }
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
  }, [board]);

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

  const isOwner = !!user && !!owner && user.id === owner.id;

  if (loading) {
    return (
      <main className="news-grid">
        <div className="news-loading-skeleton" role="status">
          {t('loading') || 'Fetching the freshest stories...'}
        </div>
      </main>
    );
  }

  if (notFound || !board) {
    return (
      <main className="news-grid">
        <div className="space-not-found">
          <div className="space-not-found-emoji">🗂️</div>
          <h2>This space doesn't exist yet</h2>
          <p>
            @{username}'s <strong>/{slug}</strong> board couldn't be found. It may have been
            renamed or removed.
          </p>
          <button type="button" className="sign-in-button primary-button" onClick={onHome}>
            Back to Littlables
          </button>
        </div>
      </main>
    );
  }

  const pills = board.pills && board.pills.length > 0 ? board.pills : [];

  return (
    <main id="news-grid-container" className="news-grid">
      <div className="board-page-header">
        {board.logo_url ? (
          <img src={board.logo_url} alt={`${board.name} logo`} className="board-page-logo" />
        ) : (
          <div className="board-page-logo-fallback">{(board.name || '?')[0].toUpperCase()}</div>
        )}
        <div>
          <h1 className="board-page-title">{board.name}</h1>
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
          {board.description && <p className="board-page-description">{board.description}</p>}
          {playroom && (
            <div className="board-page-owner" style={{ marginTop: '0.35rem' }}>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  window.history.pushState({}, '', `/@${username}/${playroom.slug}`);
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                ← Back to 🛝 {playroom.name}
              </button>
            </div>
          )}
        </div>
        {isOwner && (
          <button type="button" className="sign-in-button secondary-button" onClick={onOpenProfile}>
            ✏️ Edit boards
          </button>
        )}
      </div>

      {stories.length === 0 ? (
        <div className="board-empty">
          <p>
            {pills.length === 0
              ? 'This board has no topics yet.'
              : 'No fresh stories on these topics right now — check back soon.'}
          </p>
        </div>
      ) : (
        stories.map((story, index) => {
          const storyId = getStoryId(story.title, story.link);
          const cardReactions = reactions[storyId] || { love: 0, mind: 0, cozy: 0 };
          const shouldInsertAd = (index + 1) % 3 === 0;
          const adIndex = Math.floor(index / 3);
          const currentAd = storyAds[index] || (ads.length > 0 ? ads[adIndex % ads.length] : null);
          return (
            <React.Fragment key={`${story.link}-${index}`}>
              <NewsCard
                item={story}
                index={index}
                category={(story.category as NewsCategory) || 'all'}
                categoryBadge={getBestInterestLabel(story) || story.category || board?.name || ''}
                reactions={cardReactions}
                onReact={handleReaction}
                onOpenStory={handleOpenStory}
              />
              {shouldInsertAd && currentAd && (
                <AdCard ad={currentAd} category="all" />
              )}
            </React.Fragment>
          );
        })
      )}
    </main>
  );
};

export default BoardPage;
