import React, { useEffect, useState, useCallback } from 'react';
import { Profile, useAuth } from '../contexts/AuthContext';
import {
  Playroom,
  getPlayroomBySlug,
  getPlayroomSpaces,
} from '../services/playroomService';
import type { Space } from '../services/spaceService';
import { getSpaceEmoji } from '../services/spaceEmojiService';
import {
  fetchPlayroomFeed,
  getCachedPlayroomFeed,
  prefetchPlayroomSpaces,
  filterStoriesForSpace,
} from '../services/playroomFeedService';
import { AdCard } from './AdCard';
import { fetchAdsForCategory, getCachedAdsForCategory, fetchMatchedAdIds } from '../services/adsService';
import {
  fetchReactionsForStories,
  toggleStoryReaction,
  getStoryId,
} from '../services/supabaseService';
import { NewsCard } from './NewsCard';
import { StoryModal } from './StoryModal';
import { StoryEditView } from './StoryEditView';
import { useAdminStatus } from '../hooks/useAdminStatus';
import { t } from '../constants/translations';
import { SITE_TITLE_BASE } from '../constants/config';
import { INTEREST_KEYWORDS } from '../constants/interestKeywords';
import { trackStoryDwell } from '../services/trackingService';
import type { NewsItem, NewsCategory, ReactionCounts, ReactionType, AdItem } from '../types';

// Map interest ID → label for badge display
const INTEREST_LABELS = new Map(INTEREST_KEYWORDS.map(k => [k.id, k.label]));

// Get the best (highest-confidence) interest label for a story
function getBestInterestLabel(story: NewsItem): string | null {
  const keywords = story.interestKeywords;
  if (!keywords || keywords.length === 0) return null;
  return INTEREST_LABELS.get(keywords[0]) || keywords[0];
}

export interface OpenProfileTarget {
  tab?: 'profile' | 'avatar' | 'interests' | 'theme' | 'playrooms' | 'spaces';
  playroomId?: string;
  playroom?: Playroom;
  playroomSpaces?: Space[];
  spaceId?: string;
  space?: Space;
}

interface PlayroomPageProps {
  username: string;
  slug: string;
  onHome: () => void;
  onOpenProfile?: (target?: OpenProfileTarget) => void;
  initialData?: { playroom: Playroom; ownerId: string; owner: Profile } | null;
}

const VALID_THEMES = ['dark', 'dark-purple', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

async function matchAdsForStories(stories: NewsItem[], fetchedAds: AdItem[]): Promise<Record<number, AdItem>> {
  const adSlotStories = stories
    .map((story, index) => ({ story, index }))
    .filter(({ index }) => (index + 1) % 3 === 0)
    .map(({ story, index }) => ({ ...(story as any), _index: index }));
  if (adSlotStories.length === 0 || fetchedAds.length === 0) return {};
  try {
    const matches = await Promise.race([
      fetchMatchedAdIds(adSlotStories as any),
      new Promise<Record<number, string[]>>((resolve) => setTimeout(() => resolve({}), 400)),
    ]);
    const adById = new Map<string, AdItem>();
    for (const ad of fetchedAds) {
      if (ad.id) adById.set(ad.id, ad);
    }
    const matched: Record<number, AdItem> = {};
    for (const { index } of adSlotStories.map((s) => ({ index: (s as any)._index }))) {
      const adIds = matches[index] || [];
      if (adIds.length > 0) {
        const slot = Math.floor(index / 3);
        const adId = adIds[slot % adIds.length];
        const ad = adById.get(adId);
        if (ad) matched[index] = ad;
      }
    }
    return matched;
  } catch {
    return {};
  }
}

export const PlayroomPage: React.FC<PlayroomPageProps> = ({
  username,
  slug,
  onHome,
  onOpenProfile,
  initialData,
}) => {
  const { user, profile: viewerProfile } = useAuth();
  const { isAdmin } = useAdminStatus();
  const [playroom, setPlayroom] = useState<Playroom | null>(() => initialData?.playroom ?? null);
  const [owner, setOwner] = useState<Profile | null>(() => initialData?.owner ?? null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [stories, setStories] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [storyAds, setStoryAds] = useState<Record<number, AdItem>>({});
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // When a space pill is tapped, filter the feed to that space (tap again to clear)
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedStory, setSelectedStory] = useState<{ item: NewsItem; index: number } | null>(null);
  const [adminEditStory, setAdminEditStory] = useState<NewsItem | null>(null);
  const dwellStartRef = React.useRef<{ item: NewsItem; category: string; startedAt: number } | null>(null);
  const initialLoadDoneRef = React.useRef<string | null>(null);
  const allPlayroomStoriesRef = React.useRef<NewsItem[]>([]);

  // Scroll to top when navigating to a different playroom/space
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [username, slug]);

  // Browser tab title: base + playroom name once it loads
  useEffect(() => {
    document.title = playroom ? `${SITE_TITLE_BASE} | ${playroom.name}` : SITE_TITLE_BASE;
  }, [playroom]);

  // Coordinated initial load: resolve playroom + owner, then fetch spaces, feed, and ads in parallel
  // before releasing `loading` so everything renders in a single flicker-free frame.
  useEffect(() => {
    let cancelled = false;
    const routeKey = `${username.toLowerCase()}/${slug.toLowerCase()}`;
    initialLoadDoneRef.current = null;

    (async () => {
      setLoading(true);
      setNotFound(false);
      setActiveSpaceId(null);
      try {
        const resolved =
          initialData &&
          initialData.playroom.slug.toLowerCase() === slug.toLowerCase() &&
          initialData.owner.username?.toLowerCase() === username.toLowerCase()
            ? initialData
            : await getPlayroomBySlug(username, slug);

        if (cancelled) return;
        if (!resolved) {
          setNotFound(true);
          return;
        }

        const cachedFeed = getCachedPlayroomFeed(resolved.playroom.id, null);
        const cachedAds = getCachedAdsForCategory('all');
        if (cachedFeed && cachedFeed.items.length > 0) {
          allPlayroomStoriesRef.current = cachedFeed.items;
          setPlayroom(resolved.playroom);
          setOwner(resolved.owner);
          if (cachedFeed.spaces.length > 0) setSpaces(cachedFeed.spaces);
          setStories(cachedFeed.items);
          if (cachedAds) setAds(cachedAds);
          setLoading(false);
        }

        const [playroomSpaces, feed, fetchedAds] = await Promise.all([
          getPlayroomSpaces(resolved.playroom.id).catch(() => [] as Space[]),
          fetchPlayroomFeed(resolved.playroom.id, null).catch(() => ({ items: [] as NewsItem[] })),
          fetchAdsForCategory('all').catch(() => [] as AdItem[]),
        ]);
        if (cancelled) return;

        allPlayroomStoriesRef.current = feed.items;
        setPlayroom(resolved.playroom);
        setOwner(resolved.owner);
        setSpaces(playroomSpaces);
        setStories(feed.items);
        setAds(fetchedAds);
        setStoryAds({});
        initialLoadDoneRef.current = routeKey;
        setLoading(false);

        // Background prefetch all individual spaces in this playroom so clicking any space pill is instant
        prefetchPlayroomSpaces(resolved.playroom.id, playroomSpaces);

        // Match ads non-blocking in the background
        matchAdsForStories(feed.items, fetchedAds)
          .then((matchedAds) => {
            if (!cancelled) setStoryAds(matchedAds);
          })
          .catch(() => {});

        // Fetch reactions non-blocking after the main view is ready
        if (feed.items.length > 0) {
          fetchReactionsForStories(feed.items.map((s) => getStoryId(s.title, s.link)))
            .then((data) => {
              if (!cancelled) setReactions(data);
            })
            .catch(() => {});
        } else {
          setReactions({});
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
  }, [username, slug]);

  // Refresh playroom details + spaces when edited in ProfileDialog
  useEffect(() => {
    const onPlayroomsChanged = async (e: Event) => {
      const updated = (e as CustomEvent<{ playroom?: Playroom }>).detail?.playroom;
      const targetId = updated?.id || playroom?.id;
      if (updated && (!playroom || updated.id === playroom.id)) {
        setPlayroom(updated);
        if (updated.slug && updated.slug !== slug) {
          window.history.replaceState({}, '', `/@${username}/${updated.slug}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } else if (playroom) {
        try {
          const pr = await getPlayroomBySlug(username, playroom.slug);
          if (pr) setPlayroom(pr.playroom);
        } catch {
          /* keep existing */
        }
      }
      if (targetId) {
        try {
          const playroomSpaces = await getPlayroomSpaces(targetId);
          setSpaces(playroomSpaces);
          setRefreshTick((t) => t + 1);
        } catch {
          /* keep existing */
        }
      }
    };
    window.addEventListener('littlables:playrooms-changed', onPlayroomsChanged);
    return () => window.removeEventListener('littlables:playrooms-changed', onPlayroomsChanged);
  }, [playroom, username, slug]);

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

  // Refetch stories when a space filter pill is toggled or after an edit refresh.
  // Renders cached or locally-filtered stories immediately without showing a loading spinner.
  useEffect(() => {
    const routeKey = `${username.toLowerCase()}/${slug.toLowerCase()}`;
    if (!playroom || initialLoadDoneRef.current !== routeKey) {
      return;
    }

    let cancelled = false;
    const cached = getCachedPlayroomFeed(playroom.id, activeSpaceId);
    if (cached && refreshTick === 0) {
      setStories(cached.items);
      setFeedLoading(false);
    } else if (activeSpaceId === null && allPlayroomStoriesRef.current.length > 0 && refreshTick === 0) {
      setStories(allPlayroomStoriesRef.current);
      setFeedLoading(false);
    } else if (activeSpaceId && allPlayroomStoriesRef.current.length > 0) {
      const targetSpace = spaces.find((s) => s.id === activeSpaceId);
      if (targetSpace) {
        const localFiltered = filterStoriesForSpace(allPlayroomStoriesRef.current, targetSpace);
        if (localFiltered.length > 0) {
          setStories(localFiltered);
          setFeedLoading(false);
        } else {
          setFeedLoading(true);
        }
      } else {
        setFeedLoading(true);
      }
    } else {
      setFeedLoading(true);
    }

    (async () => {
      try {
        const feed = await fetchPlayroomFeed(playroom.id, activeSpaceId, undefined, undefined, {
          forceRefresh: refreshTick > 0,
        });
        if (cancelled) return;
        if (activeSpaceId === null) {
          allPlayroomStoriesRef.current = feed.items;
        }
        setStories(feed.items);
        setFeedLoading(false);

        matchAdsForStories(feed.items, ads)
          .then((matched) => {
            if (!cancelled) setStoryAds(matched);
          })
          .catch(() => {});

        if (feed.items.length > 0) {
          fetchReactionsForStories(feed.items.map((s) => getStoryId(s.title, s.link)))
            .then((data) => {
              if (!cancelled) setReactions(data);
            })
            .catch(() => {});
        } else {
          setReactions({});
        }
      } catch {
        if (!cancelled && !cached) setStories([]);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId, refreshTick]);

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

  const handleOpenStory = useCallback((item: NewsItem, index: number) => {
    setSelectedStory({ item, index });
    dwellStartRef.current = {
      item,
      category: (item.category as string) || 'all',
      startedAt: Date.now(),
    };
  }, []);

  const handleCloseStory = useCallback(() => {
    const dwell = dwellStartRef.current;
    if (dwell) {
      const seconds = (Date.now() - dwell.startedAt) / 1000;
      trackStoryDwell(dwell.item, seconds, dwell.category);
      dwellStartRef.current = null;
    }
    setSelectedStory(null);
  }, []);

  const isOwner = !!user && ((!!owner && user.id === owner.id) || (!!playroom && user.id === playroom.user_id));

  if (loading) {
    return (
      <main className="news-grid">
        <div className="news-loading-skeleton" role="status">
          {t('loading') || 'Fetching the freshest stories...'}
        </div>
        {Array.from({ length: 6 }).map((_, idx) => (
          <article key={`skeleton-${idx}`} className="news-card news-skeleton-card" aria-hidden="true">
            <div className="news-card-image-wrap" />
            <div className="news-card-content">
              <div className="news-skeleton-line short" />
              <div className="news-skeleton-line title" />
              <div className="news-skeleton-line" />
              <div className="news-skeleton-line medium" />
            </div>
          </article>
        ))}
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
      <div className="space-page-header">
        {playroom.logo_url ? (
          <img src={playroom.logo_url} alt={`${playroom.name} logo`} className="space-page-logo" />
        ) : (
          <div className="space-page-logo-fallback">{(playroom.name || '?')[0].toUpperCase()}</div>
        )}
        <div>
          <h1 className="space-page-title">{playroom.name}</h1>
          <div className="space-page-owner">
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
          {playroom.description && <p className="space-page-description">{playroom.description}</p>}
        </div>
        {isOwner && onOpenProfile && (
          <button
            type="button"
            className="sign-in-button secondary-button"
            data-umami-event="Edit-Playroom"
            onClick={() =>
              onOpenProfile({
                tab: 'playrooms',
                playroomId: playroom.id,
                playroom,
                playroomSpaces: spaces,
              })
            }
          >
            ✏️ Edit playroom
          </button>
        )}
      </div>

      {spaces.length > 0 && (
        <div className="news-category-container playroom-space-pills">
          <nav className="news-category-bar" aria-label="Spaces in this playroom">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                className={`cat-pill${activeSpaceId === space.id ? ' active' : ''}`}
                data-umami-event="Filter-Playroom-Space"
                data-umami-event-space={space.slug}
                onClick={() => setActiveSpaceId((prev) => (prev === space.id ? null : space.id))}
              >
                {space.logo_url ? (
                  <img src={space.logo_url} alt="" className="playroom-space-pill-logo" />
                ) : (
                  <span>{getSpaceEmoji(space)}</span>
                )}
                <span className="cat-text">{space.name}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {feedLoading && stories.length === 0 ? (
        Array.from({ length: 6 }).map((_, idx) => (
          <article key={`filter-skeleton-${idx}`} className="news-card news-skeleton-card" aria-hidden="true">
            <div className="news-card-image-wrap" />
            <div className="news-card-content">
              <div className="news-skeleton-line short" />
              <div className="news-skeleton-line title" />
              <div className="news-skeleton-line" />
              <div className="news-skeleton-line medium" />
            </div>
          </article>
        ))
      ) : stories.length === 0 ? (
        <div className="space-empty">
          <p>
            {spaces.length === 0
              ? 'This playroom has no spaces yet.'
              : 'No fresh stories on these topics right now — check back soon.'}
          </p>
          {isOwner && onOpenProfile && spaces.length === 0 && (
            <button
              type="button"
              className="sign-in-button secondary-button"
              style={{ width: 'auto', margin: '0.75rem auto 0' }}
              data-umami-event="Edit-Playroom"
              onClick={() =>
                onOpenProfile({
                  tab: 'playrooms',
                  playroomId: playroom.id,
                  playroom,
                  playroomSpaces: spaces,
                })
              }
            >
              ✏️ Edit playroom
            </button>
          )}
        </div>
      ) : (
        stories.map((story, index) => {
          const storyId = getStoryId(story.title, story.link);
          const cardReactions = reactions[storyId] || { love: 0, mind: 0, cozy: 0 };
          const shouldInsertAd = (index + 1) % 3 === 0;
          const adIndex = Math.floor(index / 3);
          // Prefer keyword-matched ad for this story; fall back to rotation.
          const currentAd = storyAds[index] || (ads.length > 0 ? ads[adIndex % ads.length] : null);
          return (
            <React.Fragment key={`${story.link}-${index}`}>
              <NewsCard
                item={story}
                index={index}
                category={(story.category as NewsCategory) || 'all'}
                categoryBadge={getBestInterestLabel(story) || story.category || (activeSpaceId ? (spaces.find(s => s.id === activeSpaceId)?.name || '') : '')}
                reactions={cardReactions}
                onReact={handleReaction}
                onOpenStory={handleOpenStory}
                onAdminEdit={isAdmin ? setAdminEditStory : undefined}
              />
              {shouldInsertAd && currentAd && (
                <AdCard ad={currentAd} category="all" />
              )}
            </React.Fragment>
          );
        })
      )}

      <StoryModal
        story={selectedStory?.item || null}
        index={selectedStory?.index || 0}
        category={(selectedStory?.item.category as NewsCategory) || 'all'}
        categoryBadge={
          selectedStory
            ? getBestInterestLabel(selectedStory.item) ||
              selectedStory.item.category ||
              (activeSpaceId ? spaces.find((s) => s.id === activeSpaceId)?.name || '' : playroom.name)
            : ''
        }
        reactions={
          selectedStory
            ? reactions[getStoryId(selectedStory.item.title, selectedStory.item.link)] || { love: 0, mind: 0, cozy: 0 }
            : { love: 0, mind: 0, cozy: 0 }
        }
        onReact={handleReaction}
        onClose={handleCloseStory}
        onAdminEdit={isAdmin ? setAdminEditStory : undefined}
      />

      {adminEditStory && (
        <StoryEditView
          story={adminEditStory}
          onClose={() => setAdminEditStory(null)}
          onSaved={() => setRefreshTick((t) => t + 1)}
        />
      )}
    </main>
  );
};

export default PlayroomPage;
