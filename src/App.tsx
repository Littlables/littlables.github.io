import React, { useState, useEffect, useCallback } from 'react';
import { NewsCategory, NewsItem, AdItem, ReactionType, ReactionCounts } from './types';
import { SAVED_CATEGORY_KEY, CATEGORIES } from './constants/config';
import { useTheme } from './hooks/useTheme';
import { useSystemFont } from './hooks/useSystemFont';
import { useLockBodyScroll } from './hooks/useLockBodyScroll';
import { Header } from './components/Header';
import { CategoryNav, scrollActiveCategoryIntoView } from './components/CategoryNav';
import { NewsCard } from './components/NewsCard';
import { StoryEditView } from './components/StoryEditView';
import { useAdminStatus } from './hooks/useAdminStatus';
import { AdCard } from './components/AdCard';
import { StoryModal } from './components/StoryModal';
import { Footer } from './components/Footer';
import { InfoDialog } from './components/InfoDialog';
import { AboutPage } from './components/AboutPage';
import { SettingsDialog } from './components/SettingsDialog';
import { SignInDialog } from './components/SignInDialog';
import { ProfileDialog } from './components/ProfileDialog';
import { PublicProfilePage } from './components/PublicProfilePage';
import { BoardPage } from './components/BoardPage';
import { SpaceRoutePage } from './components/SpaceRoutePage';
import { useAuth } from './contexts/AuthContext';
import type { PillConfig } from './contexts/AuthContext';
import { fetchNewsFeed } from './services/newsService';
import { fetchAdsForCategory, fetchMatchedAdIds } from './services/adsService';
import {
  fetchReactionsForStories,
  toggleStoryReaction,
  subscribeToReactions,
  getStoryId
} from './services/supabaseService';
import { trackStoryDwell } from './services/trackingService';
import {
  parseTopicFromUrl,
  parseStoryFromUrl,
  getTopicHref,
  getStoryHref,
  matchesStoryParam,
  isCustomTopic,
  isValidCategory,
  formatCustomTopicLabel
} from './services/urlService';
import { t, getDetectedLocale } from './constants/translations';
import { getCategoryDescription } from './constants/categoryDescriptions';

/** Extracts a `@username` profile route from the URL path, e.g. `/@katie`. */
function parseProfileFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/@([a-z0-9_]{3,30})\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

/** Extracts a `@username/boardslug` board route, e.g. `/@katie/cozy-reads`. */
function parseBoardFromUrl(): { username: string; slug: string } | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/@([a-z0-9_]{3,30})\/([a-z0-9-_]{1,50})\/?$/i);
  return match ? { username: match[1].toLowerCase(), slug: match[2].toLowerCase() } : null;
}

/** Extracts a `@username/spaces/spaceslug` direct space route, e.g. `/@katie/spaces/cozy-reads`. */
function parseSpaceFromUrl(): { username: string; slug: string } | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/@([a-z0-9_]{3,30})\/spaces\/([a-z0-9-_]{1,50})\/?$/i);
  return match ? { username: match[1].toLowerCase(), slug: match[2].toLowerCase() } : null;
}

/** Extracts a `@username/playroomslug/spaceslug` playroom-context space route. */
function parsePlayroomSpaceFromUrl(): { username: string; playroom: string; space: string } | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/@([a-z0-9_]{3,30})\/([a-z0-9-_]{1,50})\/([a-z0-9-_]{1,50})\/?$/i);
  if (!match) return null;
  if (match[2].toLowerCase() === 'spaces') return null; // reserved for the direct space route
  return {
    username: match[1].toLowerCase(),
    playroom: match[2].toLowerCase(),
    space: match[3].toLowerCase(),
  };
}

/** True when on the standalone `/about` landing page. */
function parseAboutFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return /^\/about\/?$/i.test(window.location.pathname);
}

/**
 * Prioritizes stories matching the user's interests (from their profile).
 * Stories matching an interest come first (preserving their relative order),
 * followed by non-matching stories. Used on the homepage for signed-in users.
 */
function prioritizeByInterests(stories: NewsItem[], interests: PillConfig[]): NewsItem[] {
  if (!interests.length) return stories;

  const matchesInterest = (story: NewsItem): boolean => {
    const haystack = `${story.title || ''} ${story.description || ''}`.toLowerCase();
    return interests.some((pill) => {
      if (pill.type === 'category') {
        return story.category === pill.id;
      }
      // Custom interest: match keywords or label in title/description
      const terms: string[] = [];
      if (pill.keywords) {
        terms.push(...pill.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean));
      }
      if (pill.label) {
        terms.push(pill.label.toLowerCase());
      }
      return terms.some((term) => term.length > 1 && haystack.includes(term));
    });
  };

  const matching: NewsItem[] = [];
  const rest: NewsItem[] = [];
  for (const story of stories) {
    (matchesInterest(story) ? matching : rest).push(story);
  }
  return [...matching, ...rest];
}

export const App: React.FC = () => {
  const { theme, setTheme } = useTheme();
  useSystemFont();
  const { profile } = useAuth();
  const { isAdmin } = useAdminStatus();
  const [adminEditStory, setAdminEditStory] = useState<NewsItem | null>(null);

  // Apply custom background color from profile (overrides theme).
  // Setting --news-bg on :root flows into body, header, and footer,
  // which all use var(--news-bg).
  useEffect(() => {
    const bg = profile?.background_color;
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
      document.documentElement.style.setProperty('--news-bg', bg);
    } else {
      document.documentElement.style.removeProperty('--news-bg');
    }
  }, [profile?.background_color]);

  const [category, setCategoryState] = useState<NewsCategory>(() => {
    const urlTopic = parseTopicFromUrl();
    if (urlTopic) {
      return urlTopic;
    }
    try {
      const saved = localStorage.getItem(SAVED_CATEGORY_KEY) as NewsCategory;
      if (CATEGORIES.some(c => c.id === saved)) {
        return saved;
      }
    } catch {}
    return 'all';
  });

  const [stories, setStories] = useState<NewsItem[]>([]);
  const [ads, setAds] = useState<AdItem[]>([]);
  // Per-story keyword-matched ads: story index -> matched AdItem (computed after load)
  const [storyAds, setStoryAds] = useState<Record<number, AdItem>>({});
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profileRoute, setProfileRoute] = useState<string | null>(() => parseProfileFromUrl());
  const [boardRoute, setBoardRoute] = useState<{ username: string; slug: string } | null>(() => parseBoardFromUrl());
  const [spaceRoute, setSpaceRoute] = useState<{ username: string; slug: string } | null>(() => parseSpaceFromUrl());
  const [playroomSpaceRoute, setPlayroomSpaceRoute] = useState<{ username: string; playroom: string; space: string } | null>(() => parsePlayroomSpaceFromUrl());
  const [aboutRoute, setAboutRoute] = useState<boolean>(() => parseAboutFromUrl());
  // Board branding shown in the header while viewing a board page

  const [activeStoryParam, setActiveStoryParam] = useState<string | null>(() => parseStoryFromUrl());
  const [selectedStory, setSelectedStory] = useState<{ item: NewsItem; index: number } | null>(null);
  const [activeDialog, setActiveDialog] = useState<'about' | 'disclaimer' | 'settings' | 'signin' | 'profile' | null>(null);

  // Lock background scrolling whenever any dialog/modal window is open,
  // so scrolling inside the window can't chain out to the page behind it.
  // The edit view is included: it must share this single lock, not manage
  // body overflow itself — two save/restore owners racing in the modal→view
  // transition left the page stuck unscrollable (footer unreachable) or
  // unlocked behind the view (flickery chained scrolling).
  useLockBodyScroll(activeDialog !== null || selectedStory !== null || adminEditStory !== null);

  // App-level toast popover: floats above everything, unaffected by layout,
  // and persists even if the dialog that triggered it is closed
  const [toast, setToast] = useState<{ key: number; message: string; kind: 'success' | 'error' } | null>(null);
  const toastTimer = React.useRef<number | null>(null);
  // Dwell tracking: when a story preview opens and in which category
  const dwellStartRef = React.useRef<{ item: NewsItem; category: string; startedAt: number } | null>(null);
  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ key: Date.now(), message, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  // Set document title and lang from current locale and active story/topic
  useEffect(() => {
    const locale = getDetectedLocale();
    document.documentElement.lang = locale.lang;
    document.documentElement.dir = locale.lang === 'ar' ? 'rtl' : 'ltr';
    const baseTitle = t('pageTitle') || 'Littlables — A Little Scoop of the World';
    if (selectedStory?.item?.title) {
      document.title = `${selectedStory.item.title} — Littlables`;
    } else if (isCustomTopic(category)) {
      document.title = `${formatCustomTopicLabel(category)} — Littlables`;
    } else {
      document.title = baseTitle;
    }
  }, [selectedStory, category]);

  // Ensure initial URL reflects the active topic if not already in the address bar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUrlTopic = parseTopicFromUrl();
    const currentStory = parseStoryFromUrl();
    if (!currentUrlTopic && !currentStory && category !== 'all') {
      const nextHref = getTopicHref(category);
      window.history.replaceState({ topic: category, story: null }, '', nextHref);
    }
  }, []);

  // Listen to browser Back / Forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const urlAbout = parseAboutFromUrl();
      setAboutRoute(urlAbout);
      if (urlAbout) {
        setBoardRoute(null);
        setSpaceRoute(null);
        setPlayroomSpaceRoute(null);
        setProfileRoute(null);
        return;
      }
      const urlPlayroomSpace = parsePlayroomSpaceFromUrl();
      setPlayroomSpaceRoute(urlPlayroomSpace);
      if (urlPlayroomSpace) {
        setBoardRoute(null);
        setSpaceRoute(null);
        setProfileRoute(null);
        return;
      }
      const urlSpace = parseSpaceFromUrl();
      setSpaceRoute(urlSpace);
      if (urlSpace) {
        setBoardRoute(null);
        setPlayroomSpaceRoute(null);
        setProfileRoute(null);
        return;
      }
      const urlBoard = parseBoardFromUrl();
      setBoardRoute(urlBoard);
      if (urlBoard) {
        setSpaceRoute(null);
        setPlayroomSpaceRoute(null);
        setProfileRoute(null);
        return;
      }
      const urlProfile = parseProfileFromUrl();
      setProfileRoute(urlProfile);
      if (urlProfile) return;
      const urlTopic = parseTopicFromUrl() || 'all';
      const urlStory = parseStoryFromUrl();
      if (urlTopic !== category) {
        setCategoryState(urlTopic);
      }
      setActiveStoryParam(urlStory);
      if (!urlStory) {
        setSelectedStory(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [category]);

  const loadFeed = useCallback(async (cat: NewsCategory) => {
    setIsLoading(true);
    setError(null);

    let fetchedStories: NewsItem[] = [];
    try {
      // Parallel fetch news and category/keyword-based ads
      const [stories, categoryAds] = await Promise.all([
        fetchNewsFeed(cat),
        fetchAdsForCategory(cat)
      ]);

      // On the homepage, prioritize stories matching the user's interests
      let displayStories = stories;
      if (cat === 'all' && profile?.pills && profile.pills.length > 0) {
        displayStories = prioritizeByInterests(stories, profile.pills);
      }

      fetchedStories = displayStories;
      setStories(displayStories);
      setAds(categoryAds);

      // Keyword-match ads to stories server-side (non-blocking).
      // Only ad-slot stories (every 3rd) are sent — no need to classify the rest.
      // Worker classifies untagged stories, ranks ads, returns ad IDs by story index.
      // Frontend looks up ad content by ID from the JSON cache.
      // Falls back to rotation when matching fails or returns nothing.
      try {
        const adSlotStories = displayStories
          .map((story, index) => ({ story, index }))
          .filter(({ index }) => (index + 1) % 3 === 0)
          .map(({ story, index }) => ({ ...(story as any), _index: index }));
        const matches = await fetchMatchedAdIds(adSlotStories as any);
        // Build ad lookup by ID from the fetched pool
        const adById = new Map<string, AdItem>();
        for (const ad of categoryAds) {
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
        setStoryAds(matched);
      } catch {
        // Matching is optional — rotation fallback in render covers failures
        setStoryAds({});
      }
    } catch (err: any) {
      console.error('Error loading stories:', err);
      setError(err?.message || 'Unable to load stories.');
    } finally {
      // Stories are showing — release the loading state immediately.
      // Reactions load afterward and must not hold the button.
      setIsLoading(false);
    }

    // Fetch reactions for stories (non-blocking for the refresh button)
    try {
      if (fetchedStories.length > 0) {
        const storyIds = fetchedStories.map((s: NewsItem) => getStoryId(s.title, s.link));
        const reactionData = await fetchReactionsForStories(storyIds);
        setReactions(reactionData);
      } else {
        setReactions({});
      }
    } catch {
      setReactions({});
    }
  }, []);

  useEffect(() => {
    loadFeed(category);
  }, [category, loadFeed]);

  // Resolve deep-linked story parameter when stories load or URL changes
  useEffect(() => {
    if (!activeStoryParam) {
      setSelectedStory(null);
      return;
    }

    if (stories.length > 0) {
      const matchIndex = stories.findIndex(s => matchesStoryParam(s, activeStoryParam));
      if (matchIndex !== -1) {
        setSelectedStory({ item: stories[matchIndex], index: matchIndex });
        return;
      }
    }

    // If not found in the active category feed, check the combined 'all' feed as fallback
    let cancelled = false;
    if (category !== 'all') {
      fetchNewsFeed('all')
        .then((allStories) => {
          if (cancelled) return;
          const idx = allStories.findIndex(s => matchesStoryParam(s, activeStoryParam));
          if (idx !== -1) {
            setSelectedStory({ item: allStories[idx], index: idx });
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [activeStoryParam, stories, category]);

  // Subscribe to real-time reactions
  useEffect(() => {
    const unsubscribe = subscribeToReactions((storyId, type, count) => {
      setReactions(prev => {
        const current = prev[storyId] || { love: 0, mind: 0, cozy: 0 };
        return {
          ...prev,
          [storyId]: {
            ...current,
            [type]: count
          }
        };
      });
    });

    return () => unsubscribe();
  }, []);

  const handleSelectCategory = (newCat: NewsCategory) => {
    setCategoryState(newCat);
    setSelectedStory(null);
    setActiveStoryParam(null);
    if (isValidCategory(newCat)) {
      try {
        localStorage.setItem(SAVED_CATEGORY_KEY, newCat);
      } catch {}
    }
    if (typeof window !== 'undefined') {
      const nextHref = getTopicHref(newCat);
      window.history.pushState({ topic: newCat, story: null }, '', nextHref);
      window.requestAnimationFrame(() => {
        scrollActiveCategoryIntoView();
      });
    }
  };

  // Landing page CTA: signed-in users go to their public profile ("your space"),
  // signed-out users get the sign-in dialog (account creation).
  const handleAboutCta = () => {
    if (profile?.username) {
      setActiveDialog(null);
      window.history.pushState({}, '', `/@${profile.username}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0 });
    } else {
      setActiveDialog('signin');
    }
  };

  const handleHomeRefresh = () => {
    setSelectedStory(null);
    setActiveStoryParam(null);
    setProfileRoute(null);
    setBoardRoute(null);
    try {
      localStorage.setItem(SAVED_CATEGORY_KEY, 'all');
    } catch {}
    if (typeof window !== 'undefined') {
      // Always return to the site root (clears any /@username profile path)
      const homeHref = `/?topic=${encodeURIComponent('all')}`;
      if (window.location.pathname + window.location.search !== homeHref) {
        window.history.pushState({ topic: 'all', story: null }, '', homeHref);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.requestAnimationFrame(() => {
        scrollActiveCategoryIntoView();
      });
    }
    if (category !== 'all') {
      setCategoryState('all');
    } else {
      loadFeed('all');
    }
  };

  const handleOpenStory = (item: NewsItem, index: number) => {
    setSelectedStory({ item, index });
    // Start dwell timer for this story preview
    dwellStartRef.current = { item, category, startedAt: Date.now() };
    if (typeof window !== 'undefined') {
      const storyHref = getStoryHref(item, category);
      window.history.pushState({ topic: category, story: item.link }, '', storyHref);
      setActiveStoryParam(parseStoryFromUrl());
    }
  };

  const handleCloseStory = () => {
    // Send dwell time if the preview was open long enough
    const dwell = dwellStartRef.current;
    if (dwell) {
      const seconds = (Date.now() - dwell.startedAt) / 1000;
      trackStoryDwell(dwell.item, seconds, dwell.category);
      dwellStartRef.current = null;
    }
    setSelectedStory(null);
    setActiveStoryParam(null);
    if (typeof window !== 'undefined') {
      const topicHref = getTopicHref(category);
      window.history.pushState({ topic: category, story: null }, '', topicHref);
    }
  };

  const handleReaction = async (storyId: string, type: ReactionType) => {
    // Optimistic state update
    setReactions(prev => {
      const current = prev[storyId] || { love: 0, mind: 0, cozy: 0 };
      const currentVal = typeof current[type] === 'number' ? (current[type] as number) : 0;
      return {
        ...prev,
        [storyId]: {
          ...current,
          [type]: currentVal + 1
        }
      };
    });

    const result = await toggleStoryReaction(storyId, type);
    if (result.success && result.newCount != null) {
      setReactions(prev => {
        const current = prev[storyId] || { love: 0, mind: 0, cozy: 0 };
        return {
          ...prev,
          [storyId]: {
            ...current,
            [type]: result.newCount!
          }
        };
      });
    }
  };

  const getCategoryBadge = (storyCategory?: NewsCategory) => {
    if (isCustomTopic(category)) {
      return `🔍 ${formatCustomTopicLabel(category)}`;
    }
    const targetCat = storyCategory || category;
    const active = CATEGORIES.find(c => c.id === targetCat);
    if (active) {
      const icon = active.icon || '⚡';
      if (targetCat === 'all') return `${icon} ${t('breaking') || 'All'}`;
      return `${icon} ${t((active.i18nKey || 'catAll') as any)}`;
    }
    return `🔍 ${formatCustomTopicLabel(targetCat)}`;
  };

  const selectedStoryId = selectedStory
    ? getStoryId(selectedStory.item.title, selectedStory.item.link)
    : null;
  const selectedStoryReactions = selectedStoryId
    ? (reactions[selectedStoryId] || { love: 0, mind: 0, cozy: 0 })
    : { love: 0, mind: 0, cozy: 0 };

  const customTopicActive = isCustomTopic(category);
  const interleavedAdCount = customTopicActive
    ? Math.min(ads.length, Math.floor(stories.length / 3))
    : 0;
  const remainingCustomAds = customTopicActive
    ? ads.slice(interleavedAdCount)
    : [];

  return (
    <>
      <div className="news-widget-wrapper">
        <Header
          onHomeClick={handleHomeRefresh}
          onOpenSettings={() => setActiveDialog('settings')}
          onOpenSignIn={() => setActiveDialog('signin')}
          onOpenProfile={() => setActiveDialog('profile')}
          isLoading={isLoading}
          isAdmin={isAdmin}
        />

        {/* Category nav is hidden on profile/playroom/space pages — those show curated feeds, not the main feed. */}
        {!profileRoute && !boardRoute && !spaceRoute && !playroomSpaceRoute && (
          <CategoryNav
            currentCategory={category}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {aboutRoute ? (
          <main className="news-grid">
            <AboutPage
              onExplore={handleHomeRefresh}
              onSignIn={handleAboutCta}
              signedIn={!!profile?.username}
            />
          </main>
        ) : playroomSpaceRoute ? (
          <BoardPage
            username={playroomSpaceRoute.username}
            slug={playroomSpaceRoute.space}
            playroomSlug={playroomSpaceRoute.playroom}
            onHome={handleHomeRefresh}
            onOpenProfile={() => setActiveDialog('profile')}
          />
        ) : spaceRoute ? (
          <BoardPage
            username={spaceRoute.username}
            slug={spaceRoute.slug}
            onHome={handleHomeRefresh}
            onOpenProfile={() => setActiveDialog('profile')}
          />
        ) : boardRoute ? (
          <SpaceRoutePage
            username={boardRoute.username}
            slug={boardRoute.slug}
            onHome={handleHomeRefresh}
            onOpenProfile={() => setActiveDialog('profile')}
          />
        ) : profileRoute ? (
          <PublicProfilePage
            username={profileRoute}
            onHome={handleHomeRefresh}
          />
        ) : (
        <main id="news-grid-container" className="news-grid">
          {isLoading && stories.length === 0 && ads.length === 0 ? (
            <>
              <div className="news-loading-skeleton" id="news-loading-text" role="status">
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
            </>
          ) : error && stories.length === 0 && ads.length === 0 ? (
            <div className="news-feed-error" role="alert">
              <p>{t('error') || 'Unable to load live wire right now.'}</p>
              <button
                className="refresh-news-button"
                onClick={() => loadFeed(category)}
                style={{ marginTop: '0.75rem' }}
              >
                🔄 Try Again
              </button>
            </div>
          ) : customTopicActive && stories.length === 0 && ads.length === 0 ? (
            <div className="news-feed-error" role="status">
              <p>
                No stories or partner discoveries found for{' '}
                <strong>"{formatCustomTopicLabel(category)}"</strong>.
              </p>
              <button
                className="refresh-news-button"
                onClick={() => handleSelectCategory('all')}
                style={{ marginTop: '0.75rem' }}
              >
                ⚡ View All
              </button>
            </div>
          ) : !customTopicActive && stories.length === 0 && ads.length === 0 ? (
            <div className="news-feed-error" role="status">
              {(() => {
                const desc = getCategoryDescription(category);
                const catInfo = CATEGORIES.find(c => c.id === category);
                const label = catInfo ? t((catInfo.i18nKey || 'catAll') as any) : category;
                return (
                  <>
                    <p>
                      <strong>{catInfo?.icon} {label}</strong>
                    </p>
                    {desc && <p style={{ marginTop: '0.5rem', opacity: 0.85 }}>{desc}</p>}
                    <p style={{ marginTop: '0.5rem' }}>
                      No stories here yet — check back soon!
                    </p>
                  </>
                );
              })()}
              <button
                className="refresh-news-button"
                onClick={() => handleSelectCategory('all')}
                style={{ marginTop: '0.75rem' }}
              >
                ⚡ View All
              </button>
            </div>
          ) : (
            <>
              {stories.map((story, index) => {
                const storyId = getStoryId(story.title, story.link);
                const cardReactions = reactions[storyId] || { love: 0, mind: 0, cozy: 0 };
                const storyBadge = getCategoryBadge(story.category);

                const shouldInsertAd = (index + 1) % 3 === 0;
                const adIndex = Math.floor(index / 3);
                // Prefer keyword-matched ad for this story; fall back to rotation.
                const currentAd = storyAds[index] || (customTopicActive
                  ? (adIndex < ads.length ? ads[adIndex] : null)
                  : (ads && ads.length > 0 ? ads[adIndex % ads.length] : null));

                return (
                  <React.Fragment key={`${story.link}-${index}`}>
                    <NewsCard
                      item={story}
                      index={index}
                      category={category}
                      categoryBadge={storyBadge}
                      reactions={cardReactions}
                      onReact={handleReaction}
                      onOpenStory={handleOpenStory}
                      onAdminEdit={isAdmin ? setAdminEditStory : undefined}
                    />

                    {shouldInsertAd && currentAd && (
                      <AdCard ad={currentAd} category={category} />
                    )}
                  </React.Fragment>
                );
              })}

              {customTopicActive &&
                remainingCustomAds.map((ad, idx) => (
                  <AdCard
                    key={`custom-ad-${ad.url || ''}-${ad.title}-${idx}`}
                    ad={ad}
                    category={category}
                  />
                ))}
            </>
          )}
        </main>
        )}
      </div>

      <StoryModal
        story={selectedStory?.item || null}
        index={selectedStory?.index || 0}
        category={category}
        categoryBadge={selectedStory ? getCategoryBadge(selectedStory.item.category) : ''}
        reactions={selectedStoryReactions}
        onReact={handleReaction}
        onClose={handleCloseStory}
        onSelectCategory={handleSelectCategory}
        onAdminEdit={isAdmin ? setAdminEditStory : undefined}
      />

      {adminEditStory && (
        <StoryEditView
          story={adminEditStory}
          onClose={() => setAdminEditStory(null)}
          onSaved={() => loadFeed(category)}
        />
      )}

      <Footer
        onOpenAbout={() => setActiveDialog('about')}
        onOpenDisclaimer={() => setActiveDialog('disclaimer')}
      />

      <InfoDialog
        id="about"
        isOpen={activeDialog === 'about'}
        onClose={() => setActiveDialog(null)}
        onSignIn={handleAboutCta}
        signedIn={!!profile?.username}
      />

      <InfoDialog
        id="disclaimer"
        isOpen={activeDialog === 'disclaimer'}
        onClose={() => setActiveDialog(null)}
      />

      <SettingsDialog
        isOpen={activeDialog === 'settings'}
        onClose={() => setActiveDialog(null)}
        theme={theme}
        onThemeChange={setTheme}
      />

      <SignInDialog
        isOpen={activeDialog === 'signin'}
        onClose={() => setActiveDialog(null)}
      />

      <ProfileDialog
        isOpen={activeDialog === 'profile'}
        onClose={() => setActiveDialog(null)}
        notify={notify}
      />

      {toast && (
        <div key={toast.key} className={`toast-popover toast-${toast.kind}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
};

export default App;
