const MAX_FEED_BYTES = 1_000_000;
const MAX_STORY_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FEED_FETCH_TIMEOUT_MS = 10_000;
const FEED_PROVIDERS = Object.freeze({
  bing: {
    endpoint: 'https://www.bing.com/news/search',
    categories: {
      all: 'latest news',
      animals: 'wildlife news',
      tech: 'tech industry news',
      arts: 'art news today',
      world: 'foreign affairs news',
      uplifting: 'good news stories'
    }
  }
});

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

function normalizeBingArticleUrl(value) {
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

function parseBingRss(xml) {
  if (!/<rss\b/i.test(xml)) throw new Error('Bing did not return an RSS feed');
  const items = [];
  const oldestAcceptedDate = Date.now() - MAX_STORY_AGE_MS;
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
    const entry = match[1];
    const title = readXmlTag(entry, 'title');
    const bingUrl = readXmlTag(entry, 'link');
    const link = normalizeBingArticleUrl(bingUrl);
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

export async function getNewsFeed(providerName, category, market, fetcher = fetch) {
  const provider = Object.hasOwn(FEED_PROVIDERS, providerName) ? FEED_PROVIDERS[providerName] : null;
  if (!provider) throw new Error(`Unknown news feed provider: ${providerName}`);

  const query = provider.categories[category] || provider.categories.all;
  const feedUrl = new URL(provider.endpoint);
  feedUrl.searchParams.set('q', query);
  feedUrl.searchParams.set('format', 'rss');
  feedUrl.searchParams.set('freshness', 'Day');
  if (/^[a-z]{2}-[A-Z]{2}$/.test(market || '')) feedUrl.searchParams.set('mkt', market);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('Bing News feed request timed out'), FEED_FETCH_TIMEOUT_MS);
  let xml;
  try {
    const response = await fetcher(feedUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml,application/xml,text/xml',
        'User-Agent': 'Mozilla/5.0 (compatible; LittlablesFeed/1.0)'
      }
    });
    if (!response.ok) throw new Error(`Bing News feed request failed (HTTP ${response.status})`);
    const declaredSize = Number(response.headers.get('Content-Length') || 0);
    if (declaredSize > MAX_FEED_BYTES) throw new Error('Bing News feed is too large');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_FEED_BYTES) throw new Error('Bing News feed is too large');

    xml = new TextDecoder().decode(bytes);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Bing News feed request timed out after ${FEED_FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const items = parseBingRss(xml);
  if (!items.length) throw new Error('Bing News feed returned no usable stories');
  return { provider: providerName, items };
}
