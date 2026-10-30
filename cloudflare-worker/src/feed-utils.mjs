export const MAX_FEED_BYTES = 1_000_000;
export const FEED_FETCH_TIMEOUT_MS = 10_000;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const SENSITIVE_QUERY_PARAMS = ['apikey', 'api_token', 'api_key', 'apikey', 'key', 'token', 'access_token'];

export function redactFeedUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl));
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return String(rawUrl || '');
  }
}

export function extractRateLimitHeaders(headers) {
  if (!headers || typeof headers.get !== 'function') {
    return {
      retryAfterSeconds: null,
      rateLimitRemaining: null,
      rateLimitLimit: null,
      rateLimitReset: null
    };
  }

  const rawRetryAfter = headers.get('Retry-After') || headers.get('retry-after') || headers.get('x-retry-after');
  let retryAfterSeconds = null;
  if (rawRetryAfter) {
    const numeric = Number(rawRetryAfter);
    if (Number.isFinite(numeric) && numeric >= 0) {
      retryAfterSeconds = Math.ceil(numeric);
    } else {
      const parsedDate = Date.parse(rawRetryAfter);
      if (Number.isFinite(parsedDate)) {
        retryAfterSeconds = Math.max(0, Math.ceil((parsedDate - Date.now()) / 1000));
      }
    }
  }

  const rateLimitRemaining =
    headers.get('X-RateLimit-Remaining') ??
    headers.get('x-ratelimit-remaining') ??
    headers.get('RateLimit-Remaining') ??
    headers.get('X-Rate-Limit-Remaining') ??
    headers.get('X-API-Quota-Left') ??
    null;

  const rateLimitLimit =
    headers.get('X-RateLimit-Limit') ??
    headers.get('x-ratelimit-limit') ??
    headers.get('RateLimit-Limit') ??
    headers.get('X-Rate-Limit-Limit') ??
    null;

  const rawReset =
    headers.get('X-RateLimit-Reset') ??
    headers.get('x-ratelimit-reset') ??
    headers.get('RateLimit-Reset') ??
    headers.get('X-Rate-Limit-Reset') ??
    null;

  let rateLimitReset = null;
  if (rawReset) {
    const numericReset = Number(rawReset);
    if (Number.isFinite(numericReset) && numericReset > 0) {
      if (numericReset > 1_000_000_000_000) {
        rateLimitReset = new Date(numericReset).toISOString();
      } else if (numericReset > 1_000_000_000) {
        rateLimitReset = new Date(numericReset * 1000).toISOString();
      } else {
        rateLimitReset = new Date(Date.now() + numericReset * 1000).toISOString();
        if (retryAfterSeconds === null) retryAfterSeconds = Math.ceil(numericReset);
      }
    } else {
      const parsedReset = Date.parse(rawReset);
      if (Number.isFinite(parsedReset)) {
        rateLimitReset = new Date(parsedReset).toISOString();
      }
    }
  }

  if (retryAfterSeconds === null && rateLimitReset) {
    const diffSec = Math.ceil((Date.parse(rateLimitReset) - Date.now()) / 1000);
    if (Number.isFinite(diffSec) && diffSec > 0) {
      retryAfterSeconds = diffSec;
    }
  }

  return {
    retryAfterSeconds,
    rateLimitRemaining: rateLimitRemaining !== null ? String(rateLimitRemaining) : null,
    rateLimitLimit: rateLimitLimit !== null ? String(rateLimitLimit) : null,
    rateLimitReset
  };
}

export function parseProviderErrorDetail(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed?.errors) && parsed.errors.length) {
      return parsed.errors.map(e => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).join('; ').slice(0, 300);
    }
    if (typeof parsed?.error === 'string') return parsed.error.slice(0, 300);
    if (typeof parsed?.error?.message === 'string') {
      const code = parsed.error.code ? `[${parsed.error.code}] ` : '';
      return `${code}${parsed.error.message}`.slice(0, 300);
    }
    if (typeof parsed?.results?.message === 'string') return parsed.results.message.slice(0, 300);
    if (typeof parsed?.message === 'string') return parsed.message.slice(0, 300);
  } catch {
    // Fallback to plain text / XML snippet
  }
  return trimmed.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function isQuotaOrRateLimitSignal(status, rateLimitInfo = {}, errorDetail = '') {
  if (status === 429) return true;
  if (rateLimitInfo?.rateLimitRemaining === '0') return true;
  if (status === 402 || status === 403) {
    return /quota|rate[\s_-]*limit|too many requests|usage[\s_-]*limit|daily[\s_-]*limit|request[\s_-]*limit|plan[\s_-]*limit/i.test(errorDetail);
  }
  return false;
}

export class FeedProviderError extends Error {
  constructor(providerName, status, details = {}) {
    const rateLimitInfo = details.rateLimitInfo || {};
    const errorDetail = details.errorDetail || '';
    const isRateLimit = details.isRateLimit ?? isQuotaOrRateLimitSignal(status, rateLimitInfo, errorDetail);

    const metaParts = [];
    if (rateLimitInfo.retryAfterSeconds != null) metaParts.push(`retry_after=${rateLimitInfo.retryAfterSeconds}s`);
    if (rateLimitInfo.rateLimitRemaining != null) metaParts.push(`remaining=${rateLimitInfo.rateLimitRemaining}`);
    if (rateLimitInfo.rateLimitReset) metaParts.push(`reset=${rateLimitInfo.rateLimitReset}`);
    const metaSuffix = metaParts.length ? ` [${metaParts.join(', ')}]` : '';
    const detailSuffix = errorDetail ? ` — ${errorDetail}` : '';

    const baseMessage = isRateLimit
      ? `${providerName} request quota or rate limit reached (HTTP ${status})${metaSuffix}${detailSuffix}`
      : `${providerName} feed request failed (HTTP ${status})${metaSuffix}${detailSuffix}`;

    super(baseMessage);
    this.name = 'FeedProviderError';
    this.providerName = providerName;
    this.status = status;
    this.isRateLimit = isRateLimit;
    this.retryAfterSeconds = rateLimitInfo.retryAfterSeconds ?? null;
    this.rateLimitRemaining = rateLimitInfo.rateLimitRemaining ?? null;
    this.rateLimitLimit = rateLimitInfo.rateLimitLimit ?? null;
    this.rateLimitReset = rateLimitInfo.rateLimitReset ?? null;
    this.errorDetail = errorDetail;
    this.requestUrl = details.requestUrl || '';
    this.durationMs = details.durationMs ?? 0;
    this.attemptCount = details.attemptCount ?? 1;
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function requestFeed(providerName, url, {
  fetcher = fetch,
  headers = {},
  cache = false,
  responseType = 'json',
  retryDelays = [1000, 2000],
  onFetchTelemetry = null
} = {}) {
  const startTime = Date.now();
  const sanitizedUrl = redactFeedUrl(url);
  let attemptCount = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    attemptCount = attempt + 1;
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
      const rateLimitInfo = extractRateLimitHeaders(response.headers);

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch {
          await response.body?.cancel();
        }
        const errorDetail = parseProviderErrorDetail(errorText);
        const durationMs = Date.now() - startTime;
        const isRateLimit = isQuotaOrRateLimitSignal(response.status, rateLimitInfo, errorDetail);
        const error = new FeedProviderError(providerName, response.status, {
          rateLimitInfo,
          errorDetail,
          isRateLimit,
          requestUrl: sanitizedUrl,
          durationMs,
          attemptCount
        });

        if (isRateLimit) {
          console.warn(JSON.stringify({
            event: 'PROVIDER_RATE_LIMIT',
            provider: providerName,
            httpStatus: response.status,
            attempt: attemptCount,
            durationMs,
            retryAfterSeconds: error.retryAfterSeconds,
            rateLimitRemaining: error.rateLimitRemaining,
            rateLimitReset: error.rateLimitReset,
            requestUrl: sanitizedUrl,
            detail: errorDetail || error.message
          }));
          // Fail fast on rate limit if Retry-After exceeds 3 seconds or quota is exhausted
          const shouldRetry429 = response.status === 429 &&
            attempt < 2 &&
            error.retryAfterSeconds !== null &&
            error.retryAfterSeconds > 0 &&
            error.retryAfterSeconds <= 3;
          if (!shouldRetry429) {
            onFetchTelemetry?.({
              status: 'rate_limited',
              httpStatus: response.status,
              durationMs,
              attemptCount,
              retryAfterSeconds: error.retryAfterSeconds,
              rateLimitRemaining: error.rateLimitRemaining,
              rateLimitReset: error.rateLimitReset,
              requestUrl: sanitizedUrl,
              errorMessage: error.message
            });
            throw error;
          }
        }

        if (!RETRYABLE_STATUSES.has(response.status) || attempt === 2) {
          onFetchTelemetry?.({
            status: isRateLimit ? 'rate_limited' : 'failed',
            httpStatus: response.status,
            durationMs,
            attemptCount,
            retryAfterSeconds: error.retryAfterSeconds,
            rateLimitRemaining: error.rateLimitRemaining,
            rateLimitReset: error.rateLimitReset,
            requestUrl: sanitizedUrl,
            errorMessage: error.message
          });
          throw error;
        }

        const retryAfter = error.retryAfterSeconds;
        await wait(Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 8_000)
          : retryDelays[attempt] ?? (attempt + 1) * 1000);
        continue;
      }

      const declaredSize = Number(response.headers?.get?.('Content-Length') || 0);
      if (declaredSize > MAX_FEED_BYTES) throw new Error(`${providerName} response is too large`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_FEED_BYTES) throw new Error(`${providerName} response is too large`);
      const body = new TextDecoder().decode(bytes);
      const parsed = responseType === 'json' ? JSON.parse(body) : body;
      const durationMs = Date.now() - startTime;

      onFetchTelemetry?.({
        status: 'succeeded',
        httpStatus: response.status || 200,
        durationMs,
        attemptCount,
        responseBytes: bytes.byteLength,
        retryAfterSeconds: rateLimitInfo.retryAfterSeconds,
        rateLimitRemaining: rateLimitInfo.rateLimitRemaining,
        rateLimitReset: rateLimitInfo.rateLimitReset,
        requestUrl: sanitizedUrl,
        errorMessage: null
      });
      return parsed;
    } catch (error) {
      if (controller.signal.aborted) {
        const durationMs = Date.now() - startTime;
        const timeoutErr = new Error(`${providerName} feed request timed out after ${FEED_FETCH_TIMEOUT_MS}ms`);
        timeoutErr.durationMs = durationMs;
        timeoutErr.attemptCount = attemptCount;
        timeoutErr.requestUrl = sanitizedUrl;
        onFetchTelemetry?.({
          status: 'failed',
          httpStatus: null,
          durationMs,
          attemptCount,
          requestUrl: sanitizedUrl,
          errorMessage: timeoutErr.message
        });
        throw timeoutErr;
      }
      if (error instanceof FeedProviderError) {
        if (error.isRateLimit || !RETRYABLE_STATUSES.has(error.status)) throw error;
      }
      if (attempt === 2) {
        const durationMs = Date.now() - startTime;
        if (!(error instanceof FeedProviderError)) {
          onFetchTelemetry?.({
            status: 'failed',
            httpStatus: error?.status ?? null,
            durationMs,
            attemptCount,
            requestUrl: sanitizedUrl,
            errorMessage: error instanceof Error ? error.message : String(error)
          });
        }
        throw error;
      }
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
  source = '',
  providerCountry = null
}) {
  if (typeof title !== 'string' || !title.trim()) return null;
  const normalizedLink = normalizeArticleUrl(link);
  if (!normalizedLink) return null;
  return {
    title: decodeXml(title).trim().slice(0, 500),
    link: normalizedLink,
    image: normalizeImageUrl(image),
    description: typeof description === 'string' ? decodeXml(description).trim().slice(0, 4_000) : '',
    content: typeof content === 'string' ? decodeXml(content).trim().slice(0, 4_000) : '',
    pubDate: typeof pubDate === 'string' ? pubDate.trim() : '',
    source: typeof source === 'string' ? decodeXml(source).trim().slice(0, 500) : '',
    providerCountry: typeof providerCountry === 'string' ? providerCountry.trim().slice(0, 2).toUpperCase() : null
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

// Adaptive per-provider pacing for the fetch sweep (Phase 1: provider fetching).
// The sweep is sequential, so the goal is spacing, not concurrency limits:
// a provider's own calls get room to breathe, and an exhausted quota pauses
// that provider instead of hammering it into another 429.
// - remaining > 5 (or unknown, e.g. RSS providers send no headers): base pause + jitter.
// - 0 < remaining <= 5: base pause x4 + jitter (slow down as quota drains).
// - remaining <= 0 with a reset soon (<= 5 min away): wait until the reset.
// - remaining <= 0 with a distant reset: defer instead of stalling the whole
//   sequential sweep; the caller queues the provider's remaining pairs with
//   notBefore = deferUntil and moves on to other providers.
export const PACING_LOW_REMAINING = 5;
export const PACING_MAX_RESET_WAIT_MS = 5 * 60 * 1000;

export function computeAdaptiveDelayMs({
  basePauseMs,
  remaining = null,
  resetAt = null,
  nowMs = Date.now(),
  random = Math.random
} = {}) {
  const jittered = (ms) => Math.round(ms * (0.8 + random() * 0.4));
  const rem = remaining === null || remaining === undefined ? null : Number(remaining);
  if (rem === null || !Number.isFinite(rem) || rem > PACING_LOW_REMAINING) {
    return { delayMs: jittered(basePauseMs), deferUntil: null };
  }
  if (rem > 0) {
    return { delayMs: jittered(basePauseMs * 4), deferUntil: null };
  }
  const resetMs = resetAt ? Date.parse(resetAt) : NaN;
  if (Number.isFinite(resetMs) && resetMs > nowMs) {
    const waitMs = resetMs - nowMs;
    if (waitMs <= PACING_MAX_RESET_WAIT_MS) {
      return { delayMs: Math.round(waitMs + basePauseMs * (0.8 + random() * 0.4)), deferUntil: null };
    }
    return { delayMs: 0, deferUntil: new Date(resetMs).toISOString() };
  }
  return { delayMs: jittered(basePauseMs * 4), deferUntil: null };
}
