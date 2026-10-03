    const SAVED_CATEGORY_KEY = 'selected_category';
    const VALID_CATEGORIES = ['all', 'animals', 'tech', 'arts', 'world', 'uplifting'];
    let currentCategory = (() => {
      try {
        const saved = localStorage.getItem(SAVED_CATEGORY_KEY);
        return VALID_CATEGORIES.includes(saved) ? saved : 'all';
      } catch (err) {
        console.warn('Could not read saved category:', err);
        return 'all';
      }
    })();

    const CATEGORY_ICONS = {
      all: '⚡',
      animals: '🐾',
      tech: '🤖',
      arts: '🎨',
      world: '🌍',
      uplifting: '✨'
    };

    const CATEGORY_STOCK_IMAGES = {
      animals: Array.from({ length: 10 }, (_, i) => `img/animals_${i + 1}.jpg`),
      tech: Array.from({ length: 10 }, (_, i) => `img/tech_${i + 1}.jpg`),
      arts: Array.from({ length: 10 }, (_, i) => `img/arts_${i + 1}.jpg`),
      world: Array.from({ length: 10 }, (_, i) => `img/world_${i + 1}.jpg`),
      uplifting: Array.from({ length: 10 }, (_, i) => `img/uplifting_${i + 1}.jpg`),
      all: Array.from({ length: 10 }, (_, i) => `img/all_${i + 1}.jpg`)
    };

    const NEWS_CONFIG = { maxStories: 9 };

    function getDynamicNewsFeedUrl(categoryKey = currentCategory) {
      const params = getGoogleNewsParams();
      let rawRssUrl = 'https://news.google.com/rss';

      switch (categoryKey) {
        case 'tech':
          rawRssUrl = `https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?${params}`;
          break;
        case 'world':
          rawRssUrl = `https://news.google.com/rss/headlines/section/topic/WORLD?${params}`;
          break;
        case 'animals':
          rawRssUrl = `https://news.google.com/rss/search?q=animals+pets+wildlife&${params}`;
          break;
        case 'arts':
          rawRssUrl = `https://news.google.com/rss/search?q=creative+arts+crafts+culture&${params}`;
          break;
        case 'uplifting':
          rawRssUrl = `https://news.google.com/rss/search?q=good+news+positive+breakthrough&${params}`;
          break;
        case 'all':
        default:
          rawRssUrl = `https://news.google.com/rss?${params}`;
      }

      return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rawRssUrl)}`;
    }

    function resolveImageUrl(item, index, categoryKey = currentCategory) {
      if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
      if (item.enclosure && item.enclosure.link) return item.enclosure.link;

      if (item.description) {
        const match = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1] && match[1].startsWith('http')) return match[1];
      }

      const pool = CATEGORY_STOCK_IMAGES[categoryKey] || CATEGORY_STOCK_IMAGES.all;
      return pool[index % pool.length];
    }

    function getCategoryFallbackImage(categoryKey = currentCategory, index = 0) {
      const pool = CATEGORY_STOCK_IMAGES[categoryKey] || CATEGORY_STOCK_IMAGES.all;
      return pool[index % pool.length];
    }

    function getActiveCategoryBadge() {
      const icon = CATEGORY_ICONS[currentCategory] || '⚡';
      switch (currentCategory) {
        case 'animals': return `${icon} ${t('catAnimals')}`;
        case 'tech': return `${icon} ${t('catTech')}`;
        case 'arts': return `${icon} ${t('catArts')}`;
        case 'world': return `${icon} ${t('catWorld')}`;
        case 'uplifting': return `${icon} ${t('catUplifting')}`;
        case 'all':
        default: return `${icon} ${t('breaking')}`;
      }
    }

    async function loadCurrentEvents() {
      applyStaticUiTranslations();
      const container = document.getElementById('news-grid-container');
      container.innerHTML = `<div class="news-loading-skeleton">${t('loading')}</div>`;

      try {
        const response = await fetch(getDynamicNewsFeedUrl(currentCategory));
        if (!response.ok) throw new Error(`News feed request failed (HTTP ${response.status})`);
        const data = await response.json();
        if (!data.items || data.items.length === 0) throw new Error('No stories returned from endpoint');

        const itemsToDisplay = data.items
          .sort(() => Math.random() - 0.5)
          .slice(0, NEWS_CONFIG.maxStories);
        container.innerHTML = '';
        const categoryBadge = getActiveCategoryBadge();

        itemsToDisplay.forEach((item, index) => {
          container.appendChild(createNewsStoryCard(item, index, categoryBadge));
          if (index === 2 || index === 5) {
            container.appendChild(createInFeedAdCard(Math.floor(index / 3)));
          }
        });

        const displayedStoryIds = itemsToDisplay.map(item => getStoryId(item.title, item.link));
        syncReactionsFromSupabase(displayedStoryIds);
      } catch (err) {
        console.error('Error fetching news:', err);
        renderFallbackStories(container);
      }
    }

    function restoreCategoryPills() {
      const targetPill = document.querySelector(`.cat-pill[data-category="${currentCategory}"]`);
      if (!targetPill) return;
      document.querySelectorAll('.cat-pill').forEach(button => button.classList.remove('active'));
      targetPill.classList.add('active');
    }

    document.querySelectorAll('.cat-pill').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(pill => pill.classList.remove('active'));
        button.classList.add('active');
        currentCategory = button.getAttribute('data-category');
        try {
          localStorage.setItem(SAVED_CATEGORY_KEY, currentCategory);
        } catch (err) {
          console.warn('Could not save category:', err);
        }
        loadCurrentEvents();
      });
    });

    restoreCategoryPills();
    document.getElementById('refresh-news-btn').addEventListener('click', loadCurrentEvents);
    document.addEventListener('DOMContentLoaded', () => {
      ThemeManager.init();
      restoreCategoryPills();
      loadCurrentEvents();
    });
