import React, { useEffect, useState, useCallback } from 'react';
import { Profile, useAuth } from '../contexts/AuthContext';
import { Space, getSpaceBySlug } from '../services/spaceService';
import { Playroom, getPlayroomBySlug } from '../services/playroomService';
import { fetchInterestFeed, getCachedInterestFeed } from '../services/playroomFeedService';
import { AdCard } from './AdCard';
import { fetchAdsForCategory, fetchMatchedAdIds, getCachedAdsForCategory } from '../services/adsService';
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
import type { OpenProfileTarget } from './PlayroomPage';

// Map interest ID → label for badge display
const INTEREST_LABELS = new Map(INTEREST_KEYWORDS.map(k => [k.id, k.label]));

// Get the best (highest-confidence) interest label for a story
function getBestInterestLabel(story: NewsItem): string | null {
  const keywords = story.interestKeywords;
  if (!keywords || keywords.length === 0) return null;
  return INTEREST_LABELS.get(keywords[0]) || keywords[0];
}

export interface SpacePageProps {
  username: string;
  slug: string;
  /** When set, the space is viewed inside this playroom: its theme applies + a back link shows. */
  playroomSlug?: string;
  onHome: () => void;
  onOpenProfile: (target?: OpenProfileTarget) => void;
  initialData?: { space?: Space; ownerId: string; owner: Profile } | null;
}

const VALID_THEMES = ['dark-purple', 'dark', 'light', 'rainbow', 'pastel-rainbow', 'pink'];

function extractInterestIds(space: Space): string[] {
  const pills = space.pills && space.pills.length > 0 ? space.pills : [];
  const interestIds: string[] = [];
  for (const p of pills) {
    if (p.type === 'category' || p.type === 'keyword') {
      interestIds.push(p.id);
    } else if (p.type === 'custom') {
      const kws = (p.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (kws.length > 0) interestIds.push(...kws);
      else if (p.label) interestIds.push(p.label.toLowerCase());
    } else {
      interestIds.push(p.id);
    }
  }
  return interestIds;
}

async function matchAdsForStories(stories: NewsItem[], fetchedAds: AdItem[]): Promise<Record<number, AdItem>> {
  const adSlotStories = stories
    .map((story, index) => ({ story, index }))
    .filter(({ index }) => (index + 1) % 3 === 0)
    .map(({ story, index }) => ({ ...(story as any), _index: index }));
  if (adSlotStories.length === 0 || fetchedAds.length === 0) return {};
  try {
    const matches = await fetchMatchedAdIds(adSlotStories as any);
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

export const SpacePage: React.FC<SpacePageProps> = ({
  username,
  slug,
  playroomSlug,
  onHome,
  onOpenProfile,
  initialData,
}) => {
  const { user, profile: viewerProfile } = useAuth();
  const { isAdmin } = useAdminStatus();
  const [space, setSpace] = useState<Space | null>(() => initialData?.space ?? null);
  const [playroom, setPlayroom] = useState<Playroom | null>(null);
  const [owner, setOwner] = useState<Profile | null>(() => initialData?.owner ?? null);
  const [stories, setStories] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [storyAds, setStoryAds] = useState<Record<number, AdItem>>({});
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedStory, setSelectedStory] = useState<{ item: NewsItem; index: number } | null>(null);
  const [adminEditStory, setAdminEditStory] = useState<NewsItem | null>(null);
  const dwellStartRef = React.useRef<{ item: NewsItem; category: string; startedAt: number } | null>(null);

  // Scroll to top when navigating to a different space
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [username, slug, playroomSlug]);

  // Browser tab title: base + space name (prefixed with the playroom name
  // when viewing a space inside a playroom) once they load
  useEffect(() => {
    if (space && playroom) {
      document.title = `${SITE_TITLE_BASE} | ${playroom.name} | ${space.name}`;
    } else if (space) {
      document.title = `${SITE_TITLE_BASE} | ${space.name}`;
    } else {
      document.title = SITE_TITLE_BASE;
    }
  }, [space, playroom]);

  const loadContentForSpace = useCallback(async (targetSpace: Space, isCancelled: () => boolean) => {
    const interestIds = extractInterestIds(targetSpace);
    if (interestIds.length === 0) {
      return { items: [] as NewsItem[], ads: [] as AdItem[] };
    }
    const [feed, fetchedAds] = await Promise.all([
      fetchInterestFeed(interestIds).catch(() => ({ items: [] as NewsItem[] })),
      fetchAdsForCategory('all').catch(() => [] as AdItem[]),
    ]);
    if (isCancelled()) return { items: [], ads: [] };
    return { items: feed.items, ads: fetchedAds };
  }, []);

  // Coordinated initial load: resolve space + owner (+ playroom if in playroom context) + feed + ads
  // in parallel before releasing `loading` so the page renders in one flicker-free frame.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const spacePromise =
          initialData !== undefined
            ? Promise.resolve(initialData)
            : getSpaceBySlug(username, slug);
        const playroomPromise = playroomSlug
          ? getPlayroomBySlug(username, playroomSlug).catch(() => null)
          : Promise.resolve(null);

        const [spaceResult, playroomResult] = await Promise.all([spacePromise, playroomPromise]);
        if (cancelled) return;
        const resolvedSpace = spaceResult?.space;
        if (!spaceResult || !resolvedSpace) {
          setNotFound(true);
          return;
        }

        // Check cached interest feed & ads for instant render
        const interestIds = extractInterestIds(resolvedSpace);
        const cachedFeed = getCachedInterestFeed(interestIds);
        const cachedAds = getCachedAdsForCategory('all');
        if (cachedFeed && cachedFeed.items.length > 0) {
          setSpace(resolvedSpace);
          setOwner(spaceResult.owner);
          setPlayroom(playroomResult ? playroomResult.playroom : null);
          setStories(cachedFeed.items);
          setStoryAds({});
          if (cachedAds && cachedAds.length > 0) setAds(cachedAds);
          setLoading(false);
        }

        const feedBundle = await loadContentForSpace(resolvedSpace, () => cancelled);
        if (cancelled) return;

        setSpace(resolvedSpace);
        setOwner(spaceResult.owner);
        setPlayroom(playroomResult ? playroomResult.playroom : null);
        setStories(feedBundle.items);
        setAds(feedBundle.ads);
        setStoryAds({});
        setLoading(false);

        // Match ads non-blocking in the background
        if (feedBundle.items.length > 0 && feedBundle.ads.length > 0) {
          matchAdsForStories(feedBundle.items, feedBundle.ads)
            .then((matched) => {
              if (!cancelled) setStoryAds(matched);
            })
            .catch(() => {});
        }

        if (feedBundle.items.length > 0) {
          fetchReactionsForStories(feedBundle.items.map((s) => getStoryId(s.title, s.link)))
            .then((data) => {
              if (!cancelled) setReactions((prev) => ({ ...prev, ...data }));
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
  }, [username, slug, playroomSlug]);

  // Refresh space details when edited in ProfileDialog
  useEffect(() => {
    const onSpacesChanged = async (e: Event) => {
      const detail = (e as CustomEvent<{ space?: Space }>).detail;
      const updated = detail?.space;
      let nextSpace: Space | null = null;
      if (updated && space && updated.id === space.id) {
        nextSpace = updated;
        setSpace(updated);
        if (updated.slug && updated.slug !== slug) {
          const nextPath = playroomSlug
            ? `/@${username}/${playroomSlug}/${updated.slug}`
            : `/@${username}/spaces/${updated.slug}`;
          window.history.replaceState({}, '', nextPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } else if (space) {
        try {
          const result = await getSpaceBySlug(username, space.slug);
          if (result) {
            nextSpace = result.space;
            setSpace(result.space);
          }
        } catch {
          /* keep existing */
        }
      }
      if (nextSpace) {
        const feedBundle = await loadContentForSpace(nextSpace, () => false);
        setStories(feedBundle.items);
        setAds(feedBundle.ads);
        setStoryAds({});
        if (feedBundle.items.length > 0 && feedBundle.ads.length > 0) {
          matchAdsForStories(feedBundle.items, feedBundle.ads)
            .then((matched) => setStoryAds(matched))
            .catch(() => {});
        }
      }
    };
    window.addEventListener('littlables:spaces-changed', onSpacesChanged);
    return () => window.removeEventListener('littlables:spaces-changed', onSpacesChanged);
  }, [space, username, slug, playroomSlug, loadContentForSpace]);

  // Apply the theme + background, restore on unmount.
  useEffect(() => {
    if (!space) return;
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');
    const prevBg = root.style.getPropertyValue('--news-bg');
    const useViewerTheme = viewerProfile?.use_viewer_theme_for_boards === true;
    const themeSource = playroomSlug ? playroom : space;
    const theme = useViewerTheme ? null : (themeSource?.theme === 'none' ? null : (themeSource?.theme || owner?.theme));
    const bg = useViewerTheme ? null : ((playroomSlug ? playroom?.background_color : space.background_color) || owner?.background_color);
    if (theme && VALID_THEMES.includes(theme)) root.setAttribute('data-theme', theme);
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) root.style.setProperty('--news-bg', bg);
    return () => {
      if (prevTheme) root.setAttribute('data-theme', prevTheme);
      if (prevBg) root.style.setProperty('--news-bg', prevBg);
      else root.style.removeProperty('--news-bg');
    };
  }, [space, playroom, owner, playroomSlug, viewerProfile?.use_viewer_theme_for_boards]);

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

  const isOwner = !!user && ((!!owner && user.id === owner.id) || (!!space && user.id === space.user_id));

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

  if (notFound || !space) {
    return (
      <main className="news-grid">
        <div className="space-not-found">
          <div className="space-not-found-emoji">🗂️</div>
          <h2>This space doesn't exist yet</h2>
          <p>
            @{username}'s <strong>/{slug}</strong> space couldn't be found. It may have been
            renamed or removed.
          </p>
          <button type="button" className="sign-in-button primary-button" onClick={onHome}>
            Back to Littlables
          </button>
        </div>
      </main>
    );
  }

  const pills = space.pills && space.pills.length > 0 ? space.pills : [];

  return (
    <main id="news-grid-container" className="news-grid">
      <div className="space-page-header">
        {space.logo_url ? (
          <img src={space.logo_url} alt={`${space.name} logo`} className="space-page-logo" />
        ) : (
          <div className="space-page-logo-fallback">{(space.name || '?')[0].toUpperCase()}</div>
        )}
        <div>
          <h1 className="space-page-title">{space.name}</h1>
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
          {space.description && <p className="space-page-description">{space.description}</p>}
          {playroom && (
            <div className="space-page-owner" style={{ marginTop: '0.35rem' }}>
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
          <button
            type="button"
            className="sign-in-button secondary-button"
            data-umami-event="Edit-Space"
            onClick={() => onOpenProfile({ tab: 'playrooms', spaceId: space.id, space })}
          >
            ✏️ Edit space
          </button>
        )}
      </div>

      {stories.length === 0 ? (
        <div className="space-empty">
          <p>
            {pills.length === 0
              ? 'This space has no topics yet.'
              : 'No fresh stories on these topics right now — check back soon.'}
          </p>
        </div>
      ) : (
        stories.map((story, index) => {
          const storyId = getStoryId(story.title, story.link);
          const cardReactions = reactions[storyId] || { love: 0, mind: 0, cozy: 0 };
          const shouldInsertAd = (index + 1) % 3 === 0;
          // Only show ads matched to the interest tags of this balloon.
          const currentAd = storyAds[index] || null;
          return (
            <React.Fragment key={`${story.link}-${index}`}>
              <NewsCard
                item={story}
                index={index}
                category={(story.category as NewsCategory) || 'all'}
                categoryBadge={getBestInterestLabel(story) || story.category || space?.name || ''}
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
            ? getBestInterestLabel(selectedStory.item) || selectedStory.item.category || space?.name || ''
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
          onSaved={async () => {
            if (space) {
              const feedBundle = await loadContentForSpace(space, () => false);
              setStories(feedBundle.items);
              setAds(feedBundle.ads);
              setStoryAds({});
              matchAdsForStories(feedBundle.items, feedBundle.ads)
                .then((matched) => setStoryAds(matched))
                .catch(() => {});
            }
          }}
        />
      )}
    </main>
  );
};

export default SpacePage;
