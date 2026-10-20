import React, { useState, useEffect, useCallback } from 'react';
import { NewsCategory, NewsItem, AdItem, ReactionType, ReactionCounts } from './types';
import { SAVED_CATEGORY_KEY, CATEGORIES } from './constants/config';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { NewsCard } from './components/NewsCard';
import { AdCard } from './components/AdCard';
import { StoryModal } from './components/StoryModal';
import { Footer } from './components/Footer';
import { InfoDialog } from './components/InfoDialog';
import { fetchNewsFeed } from './services/newsService';
import { fetchAdsForCategory } from './services/adsService';
import {
  fetchReactionsForStories,
  toggleStoryReaction,
  subscribeToReactions,
  getStoryId
} from './services/supabaseService';
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

export const App: React.FC = () => {
  const { theme, setTheme } = useTheme();

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
  const [reactions, setReactions] = useState<Record<string, ReactionCounts>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeStoryParam, setActiveStoryParam] = useState<string | null>(() => parseStoryFromUrl());
  const [selectedStory, setSelectedStory] = useState<{ item: NewsItem; index: number } | null>(null);
  const [activeDialog, setActiveDialog] = useState<'about' | 'disclaimer' | null>(null);

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

    try {
      // Parallel fetch news and category/keyword-based ads
      const [fetchedStories, categoryAds] = await Promise.all([
        fetchNewsFeed(cat),
        fetchAdsForCategory(cat)
      ]);

      setStories(fetchedStories);
      setAds(categoryAds);

      // Fetch reactions for stories
      if (fetchedStories.length > 0) {
        const storyIds = fetchedStories.map((s: NewsItem) => getStoryId(s.title, s.link));
        const reactionData = await fetchReactionsForStories(storyIds);
        setReactions(reactionData);
      } else {
        setReactions({});
      }
    } catch (err: any) {
      console.error('Error loading stories:', err);
      setError(err?.message || 'Unable to load stories.');
    } finally {
      setIsLoading(false);
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
    }
  };

  const handleOpenStory = (item: NewsItem, index: number) => {
    setSelectedStory({ item, index });
    if (typeof window !== 'undefined') {
      const storyHref = getStoryHref(item, category);
      window.history.pushState({ topic: category, story: item.link }, '', storyHref);
      setActiveStoryParam(parseStoryFromUrl());
    }
  };

  const handleCloseStory = () => {
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
      if (targetCat === 'all') return `${icon} ${t('breaking') || 'Top Currents'}`;
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
          theme={theme}
          onThemeChange={setTheme}
          onRefresh={() => loadFeed(category)}
          isLoading={isLoading}
        />

        <CategoryNav
          currentCategory={category}
          onSelectCategory={handleSelectCategory}
        />

        <main id="news-grid-container" className="news-grid">
          {isLoading && stories.length === 0 && ads.length === 0 ? (
            <div className="news-loading-skeleton" id="news-loading-text">
              {t('loading') || 'Fetching the freshest stories...'}
            </div>
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
                ⚡ View Top Currents
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
                const currentAd = customTopicActive
                  ? (adIndex < ads.length ? ads[adIndex] : null)
                  : (ads && ads.length > 0 ? ads[adIndex % ads.length] : null);

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
      />

      <Footer
        onOpenAbout={() => setActiveDialog('about')}
        onOpenDisclaimer={() => setActiveDialog('disclaimer')}
      />

      <InfoDialog
        id="about"
        isOpen={activeDialog === 'about'}
        onClose={() => setActiveDialog(null)}
      />

      <InfoDialog
        id="disclaimer"
        isOpen={activeDialog === 'disclaimer'}
        onClose={() => setActiveDialog(null)}
      />
    </>
  );
};

export default App;
