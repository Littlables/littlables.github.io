export const NEWS_CATEGORIES = Object.freeze([
  'all',
  'childcare',
  'animals',
  'arts',
  'tech',
  'world',
  'uplifting'
]);

const CATEGORY_QUERIES = Object.freeze({
  all: 'latest news',
  childcare: 'childcare OR parenting OR family',
  animals: 'animals OR wildlife OR conservation',
  arts: 'arts OR culture OR creative',
  tech: 'artificial intelligence OR technology',
  world: 'world news',
  uplifting: '"good news" OR positive news'
});

export const NEWS_PROVIDERS = Object.freeze({
  gnews: {
    label: 'GNews',
    description: 'API feed with headlines and topic searches.',
    adapter: 'gnews',
    endpoint: 'https://gnews.io/api/v4',
    credential: 'GNEWS_API_KEY',
    updatePauseMs: 1000,
    categories: {
      all: { endpoint: 'top-headlines', category: 'general' },
      childcare: { endpoint: 'search', query: CATEGORY_QUERIES.childcare },
      animals: { endpoint: 'search', query: CATEGORY_QUERIES.animals },
      arts: { endpoint: 'search', query: CATEGORY_QUERIES.arts },
      tech: { endpoint: 'search', query: CATEGORY_QUERIES.tech },
      world: { endpoint: 'top-headlines', category: 'world' },
      uplifting: { endpoint: 'search', query: CATEGORY_QUERIES.uplifting }
    }
  },
  bing: {
    label: 'Bing News',
    description: 'RSS search feed for news headlines.',
    adapter: 'bing',
    endpoint: 'https://www.bing.com/news/search',
    updatePauseMs: 2000,
    categories: Object.fromEntries(NEWS_CATEGORIES.map(category => [category, CATEGORY_QUERIES[category]]))
  },
  newsdata: {
    label: 'NewsData.io',
    description: 'Latest-news API filtered by topic.',
    adapter: 'newsdata',
    endpoint: 'https://newsdata.io/api/1/latest',
    credential: 'NEWSDATA_API_KEY',
    updatePauseMs: 1200,
    categories: Object.fromEntries(NEWS_CATEGORIES.map(category => [category, CATEGORY_QUERIES[category]]))
  },
  thenewsapi: {
    label: 'TheNewsAPI.com',
    description: 'News search API filtered by topic.',
    adapter: 'thenewsapi',
    endpoint: 'https://api.thenewsapi.com/v1/news/all',
    credential: 'THENEWSAPI_API_KEY',
    updatePauseMs: 1200,
    categories: Object.fromEntries(NEWS_CATEGORIES.map(category => [category, CATEGORY_QUERIES[category]]))
  },
  worldnewsapi: {
    label: 'WorldNewsAPI',
    description: 'News search API, sorted by publication time.',
    adapter: 'worldnewsapi',
    endpoint: 'https://api.worldnewsapi.com/search-news',
    credential: 'WORLDNEWSAPI_API_KEY',
    updatePauseMs: 1200,
    categories: Object.fromEntries(NEWS_CATEGORIES.map(category => [category, CATEGORY_QUERIES[category]]))
  },
  reddit: {
    label: 'Reddit RSS',
    description: 'Public subreddit RSS feed; does not require an API key.',
    adapter: 'reddit',
    updatePauseMs: 6000,
    retryDelays: [6000, 12000],
    categories: {
      all: ['news', 'worldnews'],
      childcare: ['Parenting', 'ScienceBasedParenting'],
      animals: ['NatureIsFuckingLit', 'wildlife'],
      arts: ['Art', 'arts'],
      tech: ['technology', 'artificial'],
      world: ['worldnews', 'news'],
      uplifting: ['UpliftingNews']
    }
  }
});

export function getNewsProviderConfig(providerId) {
  return NEWS_PROVIDERS[providerId] || null;
}

export function getNewsProviders(env = {}) {
  return Object.entries(NEWS_PROVIDERS).map(([id, config]) => ({
    id,
    name: config.label,
    description: config.description,
    categories: NEWS_CATEGORIES.filter(category => Object.hasOwn(config.categories, category)),
    update_pause_ms: config.updatePauseMs,
    credential_name: config.credential || null,
    configured: !config.credential || Boolean(env[config.credential])
  }));
}

// Category-major pair order for the hourly sweep (Phase 1: provider fetching).
// All providers' childcare runs before all providers' animals, and so on, so
// each provider gets the other providers' fetches as breathing room between
// its own calls instead of 7 back-to-back hits. Pairs a provider does not
// define a query for are skipped.
export function buildInterleavedPairs(providerIds) {
  const pairs = [];
  for (const category of NEWS_CATEGORIES) {
    for (const id of providerIds) {
      const config = NEWS_PROVIDERS[id];
      if (config && Object.hasOwn(config.categories, category)) {
        pairs.push({ provider: id, category });
      }
    }
  }
  return pairs;
}
