const MAX_FEED_BYTES = 1_000_000;
const MAX_STORY_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FEED_FETCH_TIMEOUT_MS = 10_000;
const NEWS_CATEGORIES = Object.freeze([
  'all',
  'childcare',
  'animals',
  'arts',
  'tech',
  'world',
  'uplifting'
]);

const FEED_PROVIDERS = Object.freeze({
  gnews: {
    label: 'GNews',
    endpoint: 'https://gnews.io/api/v4',
    categories: {
      all: { endpoint: 'top-headlines', category: 'general' },
      childcare: { endpoint: 'search', query: 'childcare OR parenting OR family' },
      animals: { endpoint: 'search', query: 'animals OR wildlife OR conservation' },
      tech: { endpoint: 'search', query: 'artificial intelligence OR technology' },
      arts: { endpoint: 'search', query: 'arts OR culture OR creative' },
      world: { endpoint: 'top-headlines', category: 'world' },
      uplifting: { endpoint: 'search', query: '"good news" OR positive news' }
    }
  },
  bing: {
    label: 'Bing News',
    endpoint: 'https://www.bing.com/news/search',
    categories: {
      all: 'latest news',
      childcare: 'childcare family parenting news',
      animals: 'wildlife news',
      tech: 'tech industry news',
      arts: 'art news today',
      world: 'foreign affairs news',
      uplifting: 'good news stories'
    }
  }
});

export function getNewsProviders() {
  return Object.entries(FEED_PROVIDERS).map(([id, config]) => ({
    id,
    name: config.label,
    categories: NEWS_CATEGORIES.filter(category => Object.hasOwn(config.categories, category))
  }));
}

class FeedProviderError extends Error {
  constructor(providerName, status) {
    const name = providerName === 'gnews' ? 'GNews' : 'Bing News';
    const message = status === 429
      ? `${name} request quota or rate limit reached`
      : `${name} feed request failed`;
    super(`${message} (HTTP ${status})`);
    this.name = 'FeedProviderError';
    this.status = status;
  }
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(parseInt(code, 16)));
}

function decodeCodePoint(codePoint) {
  return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readXmlTag(xml, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}\\s*>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

function normalizeArticleUrl(value) {
  try {
    const url = new URL(value);
    const isBingClick = (url.hostname === 'bing.com' || url.hostname.endsWith('.bing.com')) &&
      /\/news\/apiclick\.aspx$/i.test(url.pathname);
    const publisherUrl = isBingClick ? url.searchParams.get('url') : url.href;
    if (!publisherUrl) return null;

    let publisher;
    try {
      publisher = new URL(publisherUrl);
    } catch {
      try {
        publisher = new URL(decodeURIComponent(publisherUrl));
      } catch {
        return null;
      }
    }
    if (!['http:', 'https:'].includes(publisher.protocol) || publisher.username || publisher.password) return null;
    return publisher.href;
  } catch {
    return null;
  }
}

function normalizeImageUrl(value) {
  try {
    const imageUrl = new URL(value);
    if (!['http:', 'https:'].includes(imageUrl.protocol) || imageUrl.username || imageUrl.password) return '';
    if (imageUrl.protocol === 'http:' && imageUrl.hostname === 'www.bing.com') {
      imageUrl.protocol = 'https:';
    }
    return imageUrl.href;
  } catch {
    return '';
  }
}

function normalizeGNewsArticle(article) {
  if (!article || typeof article.title !== 'string' || typeof article.url !== 'string') return null;
  const link = normalizeArticleUrl(article.url);
  if (!link) return null;

  const source = typeof article.source?.name === 'string' ? article.source.name : '';
  return {
    title: article.title.trim(),
    link,
    image: typeof article.image === 'string' ? normalizeImageUrl(article.image) : '',
    description: escapeHtml(typeof article.description === 'string' ? article.description.trim() : ''),
    content: escapeHtml(typeof article.content === 'string' ? article.content.trim() : ''),
    pubDate: typeof article.publishedAt === 'string' ? article.publishedAt : '',
    source
  };
}

function parseGNewsResponse(body) {
  if (!body || !Array.isArray(body.articles)) {
    throw new Error('GNews returned an invalid article response');
  }
  const items = body.articles
    .map(normalizeGNewsArticle)
    .filter(item => item && item.title);
  if (!items.length) throw new Error('GNews returned no usable stories');
  return items;
}

function parseBingRss(xml) {
  if (!/<rss\b/i.test(xml)) throw new Error('Bing did not return an RSS feed');
  const items = [];
  const oldestAcceptedDate = Date.now() - MAX_STORY_AGE_MS;
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
    const entry = match[1];
    const title = readXmlTag(entry, 'title');
    const bingUrl = readXmlTag(entry, 'link');
    const link = normalizeArticleUrl(bingUrl);
    if (!title || !link) continue;

    const pubDate = readXmlTag(entry, 'pubDate');
    const publishedAt = Date.parse(pubDate);
    if (Number.isFinite(publishedAt) && publishedAt < oldestAcceptedDate) continue;

    const description = readXmlTag(entry, 'description');
    items.push({
      title,
      link,
      image: normalizeImageUrl(readXmlTag(entry, 'News:Image')),
      description: escapeHtml(description),
      pubDate,
      source: readXmlTag(entry, 'News:Source')
    });
  }
  return items;
}

export async function getNewsFeed(providerName, category, market, {
  apiKey = '',
  fetcher = fetch,
  cache = true,
  retryDelays = [1000, 2000]
} = {}) {
  const provider = Object.hasOwn(FEED_PROVIDERS, providerName) ? FEED_PROVIDERS[providerName] : null;
  if (!provider) throw new Error(`Unknown news feed provider: ${providerName}`);

  if (providerName === 'gnews' && !apiKey) {
    throw new Error('GNews API key is not configured. Set the GNEWS_API_KEY Worker secret.');
  }

  const categoryConfig = provider.categories[category] || provider.categories.all;
  const endpoint = providerName === 'gnews' ? categoryConfig.endpoint : '';
  const feedUrl = new URL(
    providerName === 'gnews'
      ? `${provider.endpoint}/${endpoint}`
      : provider.endpoint
  );
  if (providerName === 'gnews') {
    if (categoryConfig.query) feedUrl.searchParams.set('q', categoryConfig.query);
    if (categoryConfig.category) feedUrl.searchParams.set('category', categoryConfig.category);
    feedUrl.searchParams.set('max', '10');
    const [language, country] = (market || '').split('-');
    if (/^[a-z]{2,3}$/i.test(language || '')) feedUrl.searchParams.set('lang', language.toLowerCase());
    if (/^[A-Z]{2}$/i.test(country || '')) feedUrl.searchParams.set('country', country.toLowerCase());
  } else {
    feedUrl.searchParams.set('q', categoryConfig);
    feedUrl.searchParams.set('format', 'rss');
    feedUrl.searchParams.set('freshness', 'Day');
    if (/^[a-z]{2}-[A-Z]{2}$/.test(market || '')) feedUrl.searchParams.set('mkt', market);
  }

  const feedName = providerName === 'gnews' ? 'GNews' : 'Bing News';
  let responseBody;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(`${feedName} feed request timed out`), FEED_FETCH_TIMEOUT_MS);
    try {
      const requestOptions = providerName === 'gnews'
        ? {
            signal: controller.signal,
            ...(cache ? { cf: { cacheTtl: 300, cacheEverything: true } } : {}),
            headers: {
              Accept: 'application/json',
              'X-Api-Key': apiKey
            }
          }
        : {
            signal: controller.signal,
            headers: {
              Accept: 'application/rss+xml,application/xml,text/xml',
              'User-Agent': 'Mozilla/5.0 (compatible; LittlablesFeed/1.0)'
            }
          };
      const response = await fetcher(feedUrl, requestOptions);
      if (!response.ok) {
        const error = new FeedProviderError(providerName, response.status);
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw error;
        const retryAfter = Number(response.headers.get('Retry-After'));
        await response.body?.cancel();
        clearTimeout(timeout);
        await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 8_000)
          : retryDelays[attempt] ?? (attempt + 1) * 1000));
        continue;
      }
      const declaredSize = Number(response.headers.get('Content-Length') || 0);
      if (declaredSize > MAX_FEED_BYTES) throw new Error('News feed response is too large');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_FEED_BYTES) throw new Error('News feed response is too large');

      responseBody = new TextDecoder().decode(bytes);
      break;
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`${feedName} feed request timed out after ${FEED_FETCH_TIMEOUT_MS}ms`);
      }
      if (attempt < 2) {
        clearTimeout(timeout);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt] ?? (attempt + 1) * 1000));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (responseBody === undefined) throw new Error(`${feedName} feed request failed after retries`);
  const items = providerName === 'gnews'
    ? parseGNewsResponse(JSON.parse(responseBody))
    : parseBingRss(responseBody);
  return { provider: providerName, items };
}
