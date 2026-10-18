import React, { useState, useEffect, useCallback } from 'react';
import { NewsCategory, NewsItem, AdItem, ReactionType, ReactionCounts } from './types';
import { SAVED_CATEGORY_KEY, CATEGORIES } from './constants/config';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { NewsCard } from './components/NewsCard';
import { AdCard } from './components/AdCard';
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
import { t, getDetectedLocale } from './constants/translations';

export const App: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const [category, setCategoryState] = useState<NewsCategory>(() => {
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

  const [activeDialog, setActiveDialog] = useState<'about' | 'disclaimer' | null>(null);

  // Set document title and lang from current locale
  useEffect(() => {
    const locale = getDetectedLocale();
    document.documentElement.lang = locale.lang;
    document.documentElement.dir = locale.lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('pageTitle') || 'Littlables — A Little Scoop of the World';
  }, []);

  const loadFeed = useCallback(async (cat: NewsCategory) => {
    setIsLoading(true);
    setError(null);

    try {
      // Parallel fetch news and category-based ads
      const [fetchedStories, categoryAds] = await Promise.all([
        fetchNewsFeed(cat),
        fetchAdsForCategory(cat)
      ]);

      setStories(fetchedStories);
      setAds(categoryAds);

      // Fetch reactions for stories
      const storyIds = fetchedStories.map((s: NewsItem) => getStoryId(s.title, s.link));
      const reactionData = await fetchReactionsForStories(storyIds);
      setReactions(reactionData);
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
    try {
      localStorage.setItem(SAVED_CATEGORY_KEY, newCat);
    } catch {}
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

  const getCategoryBadge = () => {
    const active = CATEGORIES.find(c => c.id === category);
    const icon = active?.icon || '⚡';
    if (category === 'all') return `${icon} ${t('breaking') || 'Top Currents'}`;
    return `${icon} ${t((active?.i18nKey || 'catAll') as any)}`;
  };

  const categoryBadge = getCategoryBadge();

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
          {isLoading && stories.length === 0 ? (
            <div className="news-loading-skeleton" id="news-loading-text">
              {t('loading') || 'Fetching the freshest stories...'}
            </div>
          ) : error && stories.length === 0 ? (
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
          ) : (
            stories.map((story, index) => {
              const storyId = getStoryId(story.title, story.link);
              const cardReactions = reactions[storyId] || { love: 0, mind: 0, cozy: 0 };

              // Insert ads continuously every 3 stories (after story 3, 6, 9, 12, etc.) until stories end
              const shouldInsertAd = (index + 1) % 3 === 0;
              const adIndex = Math.floor(index / 3);
              const currentAd = ads && ads.length > 0 ? ads[adIndex % ads.length] : null;

              return (
                <React.Fragment key={`${story.link}-${index}`}>
                  <NewsCard
                    item={story}
                    index={index}
                    category={category}
                    categoryBadge={categoryBadge}
                    reactions={cardReactions}
                    onReact={handleReaction}
                  />

                  {shouldInsertAd && currentAd && (
                    <AdCard ad={currentAd} category={category} />
                  )}
                </React.Fragment>
              );
            })
          )}
        </main>
      </div>

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
