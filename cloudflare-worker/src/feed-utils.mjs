export const MAX_FEED_BYTES = 1_000_000;
export const FEED_FETCH_TIMEOUT_MS = 10_000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export class FeedProviderError extends Error {
  constructor(providerName, status) {
    super(status === 429
      ? `${providerName} request quota or rate limit reached (HTTP ${status})`
      : `${providerName} feed request failed (HTTP ${status})`);
    this.name = 'FeedProviderError';
    this.status = status;
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function requestFeed(providerName, url, {
  fetcher = fetch,
  headers = {},
  cache = false,
  responseType = 'json',
  retryDelays = [1000, 2000]
} = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(`${providerName} feed request timed out`),
      FEED_FETCH_TIMEOUT_MS
    );

    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        ...(cache ? { cf: { cacheTtl: 300, cacheEverything: true } } : {}),
        headers
      });
      if (!response.ok) {
        const error = new FeedProviderError(providerName, response.status);
        if (!RETRYABLE_STATUSES.has(response.status) || attempt === 2) throw error;
        const retryAfter = Number(response.headers.get('Retry-After'));
        await response.body?.cancel();
        await wait(Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 8_000)
          : retryDelays[attempt] ?? (attempt + 1) * 1000);
        continue;
      }

      const declaredSize = Number(response.headers.get('Content-Length') || 0);
      if (declaredSize > MAX_FEED_BYTES) throw new Error(`${providerName} response is too large`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_FEED_BYTES) throw new Error(`${providerName} response is too large`);
      const body = new TextDecoder().decode(bytes);
      return responseType === 'json' ? JSON.parse(body) : body;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`${providerName} feed request timed out after ${FEED_FETCH_TIMEOUT_MS}ms`);
      }
      if (error instanceof FeedProviderError && !RETRYABLE_STATUSES.has(error.status)) throw error;
      if (attempt === 2) throw error;
      await wait(retryDelays[attempt] ?? (attempt + 1) * 1000);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${providerName} feed request failed after retries`);
}

function decodeCodePoint(codePoint) {
  return codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : '\ufffd';
}

export function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => decodeCodePoint(parseInt(code, 16)));
}

export function readXmlTag(xml, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}\\s*>`, 'i'));
  return match ? decodeXml(match[1]).trim() : '';
}

export function readXmlAttribute(xml, tagName, attributeName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = xml.match(new RegExp(`<${escapedTag}\\b[^>]*>`, 'i'))?.[0] || '';
  const escapedAttribute = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = tag.match(new RegExp(`${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return value ? decodeXml(value[1] ?? value[2] ?? '') : '';
}

export function normalizeArticleUrl(value) {
  try {
    const url = new URL(value);
    const isBingClick = (url.hostname === 'bing.com' || url.hostname.endsWith('.bing.com')) &&
      /\/news\/apiclick\.aspx$/i.test(url.pathname);
    const publisherUrl = isBingClick ? url.searchParams.get('url') : url.href;
    if (!publisherUrl) return null;

    let articleUrl;
    try {
      articleUrl = new URL(publisherUrl);
    } catch {
      articleUrl = new URL(decodeURIComponent(publisherUrl));
    }
    if (!['http:', 'https:'].includes(articleUrl.protocol) ||
        articleUrl.username || articleUrl.password) return null;
    return articleUrl.href;
  } catch {
    return null;
  }
}

export function normalizeImageUrl(value) {
  try {
    const imageUrl = new URL(value);
    if (!['http:', 'https:'].includes(imageUrl.protocol) ||
        imageUrl.username || imageUrl.password) return '';
    if (imageUrl.protocol === 'http:' && imageUrl.hostname === 'www.bing.com') {
      imageUrl.protocol = 'https:';
    }
    return imageUrl.href;
  } catch {
    return '';
  }
}

export function normalizeArticle({
  title,
  link,
  image = '',
  description = '',
  content = '',
  pubDate = '',
  source = ''
}) {
  if (typeof title !== 'string' || !title.trim()) return null;
  const normalizedLink = normalizeArticleUrl(link);
  if (!normalizedLink) return null;
  return {
    title: decodeXml(title).trim(),
    link: normalizedLink,
    image: normalizeImageUrl(image),
    description: typeof description === 'string' ? decodeXml(description).trim() : '',
    content: typeof content === 'string' ? decodeXml(content).trim() : '',
    pubDate: typeof pubDate === 'string' ? pubDate.trim() : '',
    source: typeof source === 'string' ? decodeXml(source).trim() : ''
  };
}

export function parseRss(xml) {
  if (!/<rss\b/i.test(xml)) throw new Error('Provider did not return an RSS feed');
  const items = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
    const entry = match[1];
    const item = normalizeArticle({
      title: readXmlTag(entry, 'title'),
      link: readXmlTag(entry, 'link'),
      image: readXmlTag(entry, 'News:Image'),
      description: readXmlTag(entry, 'description'),
      pubDate: readXmlTag(entry, 'pubDate'),
      source: readXmlTag(entry, 'News:Source')
    });
    if (item) items.push(item);
  }
  return items;
}

export function stripMarkup(value) {
  return decodeXml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
