const MAX_CONCURRENT_GOOGLE_LOOKUPS = 2;
const GOOGLE_FETCH_TIMEOUT_MS = 6_000;
const GOOGLE_RETRY_DELAYS = [300];
const GOOGLE_NEWS_RESOLVE_URL = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';

function getGoogleNewsArticleInfo(value) {
  try {
    const url = new URL(value);
    if (url.hostname !== 'news.google.com') return null;
    const match = url.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([^/]+)\/?$/);
    if (!match) return null;
    return {
      articleId: match[1],
      locale: {
        hl: url.searchParams.get('hl') || 'en-US',
        gl: url.searchParams.get('gl') || 'US',
        ceid: url.searchParams.get('ceid') || 'US:en'
      }
    };
  } catch {
    return null;
  }
}

function isGoogleNewsUrl(value) {
  try {
    return new URL(value).hostname === 'news.google.com';
  } catch {
    return false;
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function getGoogleNewsSignature(info) {
  const url = new URL(`https://news.google.com/rss/articles/${encodeURIComponent(info.articleId)}`);
  for (const [key, value] of Object.entries(info.locale)) url.searchParams.set(key, value);
  for (let attempt = 0; attempt <= GOOGLE_RETRY_DELAYS.length; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('Google News lookup timed out'), GOOGLE_FETCH_TIMEOUT_MS);
    try {
      let currentUrl = url;
      let response;
      for (let redirects = 0; redirects <= 3; redirects++) {
        response = await fetch(currentUrl, {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': `${info.locale.hl},en;q=0.9`,
            Referer: 'https://news.google.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get('Location');
        if (!location || redirects === 3) throw new Error('Too many redirects while resolving a Google News URL');
        const nextUrl = new URL(location, currentUrl);
        if (nextUrl.hostname !== 'news.google.com') {
          throw new Error('Google News resolver redirected outside news.google.com');
        }
        currentUrl = nextUrl;
      }
      if ((response.status === 429 || response.status >= 500) && attempt < GOOGLE_RETRY_DELAYS.length) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, GOOGLE_RETRY_DELAYS[attempt]));
        continue;
      }
      if (!response.ok) throw new Error(`Google News resolver request failed (HTTP ${response.status})`);
      const html = await response.text();
      const signature = html.match(/\bdata-n-a-sg=["']([^"']+)["']/i)?.[1];
      const timestamp = html.match(/\bdata-n-a-ts=["']([^"']+)["']/i)?.[1];
      if (!signature || !timestamp) throw new Error('Google News resolver did not return article signature data');
      return { ...info, signature, timestamp };
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Google News resolver request timed out after ${GOOGLE_FETCH_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Google News resolver request failed');
}

function parseGoogleNewsResolution(responseText) {
  let body = responseText;
  if (body.includes('\n\n')) body = body.split('\n\n', 2)[1];
  body = body.trim();
  if (body.startsWith(")]}'")) body = body.split('\n', 2)[1] || body.slice(4);
  const rows = JSON.parse(body.trim());
  const resolutions = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 3 || (row[0] !== 'wrb.fr' && row[1] !== 'Fbv4je')) continue;
    const payload = typeof row[2] === 'string' ? JSON.parse(row[2]) : row[2];
    if (!Array.isArray(payload) || payload[0] !== 'garturlres' || typeof payload[1] !== 'string') continue;
    const requestId = row.slice(3).reverse().find(value => value !== null);
    resolutions.push({ requestId: requestId === undefined ? null : String(requestId), url: payload[1] });
  }
  return resolutions;
}

export async function resolveGoogleNewsUrls(urls, { isAllowedUrl = isHttpUrl, logger = console } = {}) {
  const resolved = new Array(urls.length);
  const wrappers = [];
  const signatures = new Array(urls.length);

  for (let start = 0; start < urls.length; start += MAX_CONCURRENT_GOOGLE_LOOKUPS) {
    const batch = urls.slice(start, start + MAX_CONCURRENT_GOOGLE_LOOKUPS);
    await Promise.all(batch.map(async (url, offset) => {
      const index = start + offset;
      const info = getGoogleNewsArticleInfo(url);
      if (!info) {
        if (isAllowedUrl(url) && !isGoogleNewsUrl(url)) resolved[index] = url;
        return;
      }
      wrappers.push(index);
      try {
        signatures[index] = await getGoogleNewsSignature(info);
      } catch (err) {
        logger.warn(`Unable to get Google News resolver data for ${url}:`, err);
      }
    }));
    if (start + MAX_CONCURRENT_GOOGLE_LOOKUPS < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  const requests = wrappers
    .map(index => ({ index, info: signatures[index] }))
    .filter(item => item.info);
  if (requests.length) {
    const context = [
      ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0
    ];
    const envelopes = requests.map(({ index, info }) => {
      const timestamp = /^\d+$/.test(info.timestamp) ? Number(info.timestamp) : info.timestamp;
      const payload = JSON.stringify(['garturlreq', context, info.articleId, timestamp, info.signature]);
      return ['Fbv4je', payload, null, String(index)];
    });

    try {
      const response = await fetch(GOOGLE_NEWS_RESOLVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ 'f.req': JSON.stringify([envelopes]) })
      });
      if (!response.ok) throw new Error(`Google News URL resolution failed (HTTP ${response.status})`);
      const decoded = parseGoogleNewsResolution(await response.text());
      const hasRequestIds = decoded.some(result => result.requestId !== null);
      decoded.forEach((result, offset) => {
        const requestIndex = result.requestId === null
          ? (!hasRequestIds ? requests[offset]?.index : undefined)
          : Number(result.requestId);
        if (!Number.isInteger(requestIndex)) return;
        const publisherUrl = result.url;
        if (publisherUrl && isAllowedUrl(publisherUrl) && !isGoogleNewsUrl(publisherUrl)) {
          resolved[requestIndex] = publisherUrl;
        }
      });
    } catch (err) {
      logger.warn('Google News URL resolution failed:', err);
    }
  }

  return {
    urls: [...new Set(resolved.filter(Boolean))],
    failedUrls: urls.filter((_, index) => !resolved[index]),
    resolvedByInput: urls.map((sourceUrl, index) => ({ sourceUrl, publisherUrl: resolved[index] || null }))
  };
}
