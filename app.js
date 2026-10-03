    /**
     * Active state tracking for selected category (persisted across visits)
     */
    const SAVED_CATEGORY_KEY = 'selected_category';
    let currentCategory = (function() {
      try {
        const saved = localStorage.getItem(SAVED_CATEGORY_KEY);
        if (saved && ['all', 'animals', 'tech', 'arts', 'world', 'uplifting'].includes(saved)) {
          return saved;
        }
      } catch (e) {}
      return 'all';
    })();

    /**
     * Category Icon Mapping
     */
        /**
     * Category Icon Mapping
     */
    const CATEGORY_ICONS = {
      all: '⚡',
      animals: '🐾',
      tech: '🤖',
      arts: '🎨',
      world: '🌍',
      uplifting: '✨'
    };

    /**
     * RICH CATEGORY-THEMED STOCK IMAGE BANKS
     * 36 carefully curated, high-quality images tailored to each topic
     */
    /**
     * LOCAL CATEGORY-THEMED FALLBACK IMAGES
     * Stored locally in the 'img/' folder - no 404s, no outside dependencies!
     */
    /**
     * LOCAL CATEGORY-THEMED FALLBACK IMAGES
     * Stored in the single 'img/' folder (10 per category)
     */
    const CATEGORY_STOCK_IMAGES = {
      animals: Array.from({ length: 10 }, (_, i) => `img/animals_${i + 1}.jpg`),
      tech: Array.from({ length: 10 }, (_, i) => `img/tech_${i + 1}.jpg`),
      arts: Array.from({ length: 10 }, (_, i) => `img/arts_${i + 1}.jpg`),
      world: Array.from({ length: 10 }, (_, i) => `img/world_${i + 1}.jpg`),
      uplifting: Array.from({ length: 10 }, (_, i) => `img/uplifting_${i + 1}.jpg`),
      all: Array.from({ length: 10 }, (_, i) => `img/all_${i + 1}.jpg`)
    };

    /**
     * Builds the complete CORS-friendly RSS-to-JSON endpoint URL
     * targeted to the user's active category (Mini Quest 1).
     */
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
          break;
      }

      return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rawRssUrl)}`;
    }

    /**
     * CONFIGURATION
     */
    const NEWS_CONFIG = {
      maxStories: 9,
      fallbackImages: Array.from({ length: 10 }, (_, i) => `img/all_${i + 1}.jpg`)
    };

    /**
     * Helper to clean HTML tags from raw descriptions
     */
    function stripHtml(html) {
      const doc = new DOMParser().parseFromString(html || '', 'text/html');
      return doc.body.textContent || '';
    }

    /**
     * AI Summarizer Logic:
     * Fully localized to the reader's detected language.
     */
    function generateAiSummary(title, rawDescription) {
      const cleanText = stripHtml(rawDescription);
      const sentences = cleanText.split(/(?<=[.?!।])\s+/).filter(s => s.trim().length > 15);
      const mainSubject = title.split(' - ')[0].trim();

      if (sentences.length > 0) {
        return `${t('aiTakeaway')} ${sentences[0]} ${t('aiHighlight')} ${mainSubject}.`;
      }
      return `${t('aiTakeaway')} ${t('aiDeveloping')} ${mainSubject}. ${t('aiDevelopingSuffix')}`;
    }

    /**
     * Extract or generate an image URL for the article based on its topic category
     */
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

    /**
     * Resolves the badge text for the active category
     */
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

    /**
     * Fetch stories from API and display on the static page
     */
    /**
     * Creates a native In-Feed Ad Card (Mini Quest 2)
     * Matches the card grid layout and triggers Google AdSense fluid in-feed ads.
     */
    /**
     * =========================================================
     * SUPABASE CLOUD DATABASE & REALTIME ENGINE (Hardened)
     * =========================================================
     * Safe for public anonymous voting: Uses atomic Postgres functions
     * instead of raw client writes, with live Realtime synchronization!
     */
    const SUPABASE_CONFIG = {
      url: 'https://vehbstectghtqqyiitmi.supabase.co',      // Paste your project URL here (e.g. 'https://xyzcompany.supabase.co')
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaGJzdGVjdGdodHFxeWlpdG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjQwMTYsImV4cCI6MjEwNjU0MDAxNn0.sqdrzQ0C0m3HlVDcXPMI9nUHAx_tRDfMKhWdMDlneNU',  // Paste your public anon key here
      tableName: 'article_reactions'
    };

    let supabaseClient = null;
    let realtimeChannel = null;

    if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
      try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log("⚡ Supabase Client initialized successfully!");
        setupRealtimeSubscription();
      } catch (err) {
        console.warn("Supabase init note:", err);
      }
    }

    /**
     * Sets up live Realtime subscription so any other visitor's reaction
     * pops and updates on the current user's screen in real time!
     */
    function setupRealtimeSubscription() {
      if (!supabaseClient || realtimeChannel) return;
      try {
        realtimeChannel = supabaseClient
          .channel('realtime_reactions')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: SUPABASE_CONFIG.tableName },
            payload => {
              const row = payload.new;
              if (row && row.story_id && row.reaction_type) {
                const countEl = document.querySelector(`.reaction-count[data-story="${row.story_id}"][data-type="${row.reaction_type}"]`);
                if (countEl) {
                  countEl.textContent = row.count;
                  const pill = countEl.closest('.reaction-pill');
                  if (pill) {
                    pill.classList.add('pop-bounce');
                    setTimeout(() => pill.classList.remove('pop-bounce'), 400);
                  }
                }
                localStorage.setItem(`rec_${row.story_id}_${row.reaction_type}`, row.count);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn("Realtime subscription note:", err);
      }
    }

    /**
     * Creates a stable, deterministic ID from story title and link
     */
    function getStoryId(title, link) {
      const str = ((link || '') + (title || '')).toLowerCase().trim();
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return 's_' + Math.abs(hash).toString(36).slice(0, 10);
    }

    /**
     * Gets initial reaction count from local cache or natural seed
     */
    function getReactionCount(storyId, type, seedBase) {
      const key = `rec_${storyId}_${type}`;
      const stored = localStorage.getItem(key);
      if (stored !== null) return parseInt(stored, 10);
      const seed = Math.floor(Math.abs(seedBase * 7 + (type === 'love' ? 14 : type === 'mind' ? 9 : 21)) % 38) + 4;
      localStorage.setItem(key, seed);
      return seed;
    }

    function hasUserReacted(storyId, type) {
      return localStorage.getItem(`voted_${storyId}_${type}`) === 'true';
    }

    /**
     * Syncs real database counts from Supabase for all currently displayed stories
     */
    async function syncReactionsFromSupabase(storyIds) {
      if (!supabaseClient || !storyIds || !storyIds.length) return;
      try {
        const { data, error } = await supabaseClient
          .from(SUPABASE_CONFIG.tableName)
          .select('story_id, reaction_type, count')
          .in('story_id', storyIds);

        if (error) throw error;
        if (data && data.length) {
          data.forEach(row => {
            const countEl = document.querySelector(`.reaction-count[data-story="${row.story_id}"][data-type="${row.reaction_type}"]`);
            if (countEl) countEl.textContent = row.count;
            localStorage.setItem(`rec_${row.story_id}_${row.reaction_type}`, row.count);
          });
        }
      } catch (err) {
        console.warn("Supabase fetch notice:", err);
      }
    }

    /**
     * Handles reaction button click:
     * - Immediate optimistic UI feedback (bounce & local count)
     * - Calls atomic Postgres RPC functions (increment_reaction / decrement_reaction)
     * - Database governs the true count, preventing unauthorized tampering!
     */
    async function handleReaction(btn, storyId, type) {
      btn.classList.add('pop-bounce');
      setTimeout(() => btn.classList.remove('pop-bounce'), 450);

      const countEl = btn.querySelector('.reaction-count');
      const localCount = parseInt(countEl.textContent, 10) || 0;
      const alreadyVoted = hasUserReacted(storyId, type);

      if (alreadyVoted) {
        // Toggle off (decrement)
        btn.classList.remove('voted');
        localStorage.removeItem(`voted_${storyId}_${type}`);
        countEl.textContent = Math.max(0, localCount - 1);

        if (supabaseClient) {
          try {
            const { data: dbCount, error } = await supabaseClient.rpc('decrement_reaction', {
              p_story_id: storyId,
              p_reaction_type: type
            });
            if (error || typeof dbCount !== 'number') {
              throw error || new Error('Invalid response from RPC');
            }
            countEl.textContent = dbCount;
            localStorage.setItem(`rec_${storyId}_${type}`, dbCount);
          } catch (err) {
            console.warn("RPC decrement notice:", err);
            // Roll back optimistic changes if RPC fails
            btn.classList.add('voted');
            localStorage.setItem(`voted_${storyId}_${type}`, 'true');
            countEl.textContent = localCount;
          }
        }
      } else {
        // Toggle on (increment)
        btn.classList.add('voted');
        localStorage.setItem(`voted_${storyId}_${type}`, 'true');
        countEl.textContent = localCount + 1;

        if (supabaseClient) {
          try {
            const { data: dbCount, error } = await supabaseClient.rpc('increment_reaction', {
              p_story_id: storyId,
              p_reaction_type: type
            });
            if (error || typeof dbCount !== 'number') {
              throw error || new Error('Invalid response from RPC');
            }
            countEl.textContent = dbCount;
            localStorage.setItem(`rec_${storyId}_${type}`, dbCount);
          } catch (err) {
            console.warn("RPC increment notice:", err);
            // Roll back optimistic changes if RPC fails
            btn.classList.remove('voted');
            localStorage.removeItem(`voted_${storyId}_${type}`);
            countEl.textContent = localCount;
          }
        }
      }
    }

    async function loadCurrentEvents() {
      applyStaticUiTranslations();
      const container = document.getElementById('news-grid-container');
      container.innerHTML = `<div class="news-loading-skeleton">${t('loading')}</div>`;

      try {
        const targetUrl = getDynamicNewsFeedUrl(currentCategory);
        const response = await fetch(targetUrl);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
          throw new Error('No stories returned from endpoint');
        }

        const itemsToDisplay = data.items
          .sort(() => Math.random() - 0.5)
          .slice(0, NEWS_CONFIG.maxStories);

        container.innerHTML = '';
        const categoryBadge = getActiveCategoryBadge();

        itemsToDisplay.forEach((item, index) => {
          container.appendChild(createNewsStoryCard(item, index, categoryBadge));

          // Mini Quest 2: Insert In-Feed Native Ad after 3rd and 6th story
          if (index === 2 || index === 5) {
            container.appendChild(createInFeedAdCard(Math.floor(index / 3)));
          }
        });

        // Fetch live database counts from Supabase
        const displayedStoryIds = itemsToDisplay.map((item, idx) => getStoryId(item.title, item.link));
        syncReactionsFromSupabase(displayedStoryIds);

      } catch (err) {
        console.error('Error fetching news:', err);
        renderFallbackStories(container);
      }
    }

    function restoreCategoryPills() {
      const targetPill = document.querySelector(`.cat-pill[data-category="${currentCategory}"]`);
      if (targetPill) {
        document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        targetPill.classList.add('active');
      }
    }

    // Attach Category Pill click listeners (Mini Quest 1 & persistence)
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category');
        try {
          localStorage.setItem(SAVED_CATEGORY_KEY, currentCategory);
        } catch (e) {
          console.warn('Could not save category to localStorage:', e);
        }
        loadCurrentEvents();
      });
    });

    restoreCategoryPills();

    // Attach refresh button listener & run on page load
    document.getElementById('refresh-news-btn').addEventListener('click', loadCurrentEvents);
    document.addEventListener('DOMContentLoaded', () => {
      ThemeManager.init();
      restoreCategoryPills();
      loadCurrentEvents();
    });
