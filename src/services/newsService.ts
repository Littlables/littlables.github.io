import { NewsCategory, StandardNewsCategory, NewsItem } from '../types';
import { NEWS_CONFIG, CATEGORY_STOCK_IMAGES, FALLBACK_STORIES } from '../constants/config';
import { isValidCategory, matchesKeywordQuery } from './urlService';
import { searchSupabaseStoriesByKeyword } from './supabaseService';

const STANDARD_CATEGORIES: StandardNewsCategory[] = [
  'all',
  'childcare',
  'animals',
  'arts',
  'tech',
  'world',
  'uplifting'
];

export function decodeHtmlEntities(value: string | undefined): string {
  if (!value) return '';
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value).replace(/[<>]/g, character => (
    character === '<' ? '&lt;' : '&gt;'
  ));
  return textarea.value;
}

/**
 * Resolves the display image URL for a story.
 * Supports http/https URLs, protocol-relative URLs, data URIs, and local/relative paths,
 * as well as custom images added from the admin panel.
 */
export function resolveImageUrl(item: NewsItem, index: number, category: NewsCategory): string {
  const candidate = (
    item.image ||
    item.imageUrl ||
    item.image_url ||
    item.thumbnail ||
    item.enclosure?.link ||
    ''
  ).trim();

  if (candidate) {
    if (/^https?:\/\//i.test(candidate)) return candidate;
    if (candidate.startsWith('//')) return `https:${candidate}`;
    if (candidate.startsWith('data:image/')) return candidate;
    if (candidate.startsWith('/')) return candidate;
    if (candidate.startsWith('img/') || candidate.startsWith('./')) {
      return `/${candidate.replace(/^\.\//, '')}`;
    }
  }

  // Extract from description if embedded HTML <img> tag exists
  if (item.description) {
    const match = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1]) {
      const src = match[1].trim();
      if (/^https?:\/\//i.test(src)) return src;
      if (src.startsWith('//')) return `https:${src}`;
      if (src.startsWith('data:image/')) return src;
    }
  }

  const effectiveCategory = item.category && isValidCategory(item.category)
    ? item.category
    : (isValidCategory(category) ? category : 'all');
  const pool = CATEGORY_STOCK_IMAGES[effectiveCategory] || CATEGORY_STOCK_IMAGES.all;
  return pool[index % pool.length];
}

export function normalizeFetchedItem(item: any, defaultCategory: NewsCategory = 'all'): NewsItem {
  // Admin-curated override: when displayCategories is set, the story shows under
  // those categories instead of its query-assigned one. The first entry is the
  // primary display category (card label, bucketing, interest matching).
  const displayCategories = Array.isArray(item.displayCategories) && item.displayCategories.length > 0
    ? item.displayCategories.filter((c: any) => typeof c === 'string' && isValidCategory(c))
    : null;
  const primaryCategory = displayCategories && displayCategories.length > 0 ? displayCategories[0] : null;
  return {
    ...item,
    title: decodeHtmlEntities(item.title),
    link: decodeHtmlEntities(item.link || item.article_url),
    image: decodeHtmlEntities(item.image || item.imageUrl || item.image_url),
    description: decodeHtmlEntities(item.description),
    content: decodeHtmlEntities(item.content),
    aiSummary: decodeHtmlEntities(item.aiSummary || item.ai_summary),
    source: decodeHtmlEntities(item.source || item.source_name),
    provider: item.provider,
    category: primaryCategory || item.category || defaultCategory,
    displayCategories,
    interestKeywords: Array.isArray(item.interestKeywords) && item.interestKeywords.length > 0
      ? item.interestKeywords.filter((k: any) => typeof k === 'string')
      : null,
  };
}

function isValidStoryItem(item: NewsItem): boolean {
  if (!item || typeof item.title !== 'string' || typeof item.link !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(item.link).protocol);
  } catch {
    return false;
  }
}

const RAW_CATEGORY_TTL_MS = 2 * 60 * 1000; // 2 minutes fresh window before background revalidation
const SESSION_CACHE_KEY = 'littlables_feed_cache_v1';

interface CachedFeedEntry {
  items: NewsItem[];
  fetchedAt: number;
}

const rawCategoryCache = new Map<string, CachedFeedEntry>();
const feedCache = new Map<string, CachedFeedEntry>();
const inFlightCategoryRequests = new Map<string, Promise<NewsItem[]>>();
const inFlightFeedRequests = new Map<string, Promise<NewsItem[]>>();

function normalizeCacheKey(category: NewsCategory): string {
  const trimmed = String(category || 'all').trim();
  return isValidCategory(trimmed) ? trimmed.toLowerCase() : `custom:${trimmed.toLowerCase()}`;
}

function hydrateCacheFromSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedFeedEntry>;
    if (!parsed || typeof parsed !== 'object') return;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && Array.isArray(entry.items) && entry.items.length > 0 && now - entry.fetchedAt < 15 * 60 * 1000) {
        feedCache.set(key, entry);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

hydrateCacheFromSession();

function persistCacheToSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const serializable: Record<string, CachedFeedEntry> = {};
    for (const [key, entry] of feedCache.entries()) {
      if (!key.startsWith('custom:') || Object.keys(serializable).length < 14) {
        serializable[key] = {
          items: entry.items.slice(0, 60),
          fetchedAt: entry.fetchedAt,
        };
      }
    }
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore quota or storage errors
  }
}

export function buildCategoryFeedFromRaw(feedItems: NewsItem[]): NewsItem[] {
  const approvedItems = feedItems.filter(item => item.approved === true);
  const unapprovedItems = feedItems.filter(item => item.approved !== true);
  return [...approvedItems, ...unapprovedItems];
}

async function fetchSingleCategory(
  category: NewsCategory,
  options?: { forceRefresh?: boolean }
): Promise<NewsItem[]> {
  const key = String(category || 'all').trim().toLowerCase();
  const forceRefresh = options?.forceRefresh === true;
  const cached = rawCategoryCache.get(key);

  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < RAW_CATEGORY_TTL_MS) {
    return cached.items;
  }

  const existingInFlight = inFlightCategoryRequests.get(key);
  if (!forceRefresh && existingInFlight) {
    return existingInFlight;
  }

  const requestPromise = (async () => {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/space';
    url.searchParams.set('interest', category);

    let response = await fetch(url.href, forceRefresh ? { cache: 'no-cache' } : undefined);
    if (response.status === 404) {
      const legacyUrl = new URL(NEWS_CONFIG.workerUrl);
      legacyUrl.pathname = '/feed';
      legacyUrl.searchParams.set('category', category);
      response = await fetch(legacyUrl.href, forceRefresh ? { cache: 'no-cache' } : undefined);
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `News feed request failed (HTTP ${response.status})`);
    }

    if (!Array.isArray(data.items)) return [];

    const items = data.items
      .filter((item: any) => item && typeof (item.link || item.article_url) === 'string')
      .map((item: any) => {
        const normalized = normalizeFetchedItem(item, category);
        if (
          isValidCategory(category) &&
          Array.isArray(normalized.displayCategories) &&
          normalized.displayCategories.includes(category)
        ) {
          normalized.category = category;
        }
        return normalized;
      })
      .filter(isValidStoryItem);

    const now = Date.now();
    rawCategoryCache.set(key, { items, fetchedAt: now });

    // Also pre-populate the individual standard category feed cache so switching to it is instant
    if (isValidCategory(category) && category !== 'all' && items.length > 0) {
      const mergedCat = buildCategoryFeedFromRaw(items);
      feedCache.set(normalizeCacheKey(category), { items: mergedCat, fetchedAt: now });
    }

    return items;
  })();

  inFlightCategoryRequests.set(key, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightCategoryRequests.delete(key);
  }
}

function storyMatchesKeyword(item: NewsItem, keyword: string): boolean {
  const parts = String(keyword || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return parts.some((part) => storyMatchesKeyword(item, part));
  }

  const single = (parts[0] || '').toLowerCase();
  if (!single) return false;
  if (single === 'all') return true;
  if (isValidCategory(single) && item.category?.toLowerCase() === single) {
    return true;
  }

  const searchable = [
    item.title,
    item.description,
    item.aiSummary,
    item.content,
    item.source,
    item.provider,
    item.category,
    ...(Array.isArray(item.interestKeywords) ? item.interestKeywords : [])
  ]
    .filter(Boolean)
    .join(' ');

  return matchesKeywordQuery(searchable, single);
}

const byPublicationDate = (first: NewsItem, second: NewsItem) => {
  const firstDate = Date.parse(first.pubDate || first.fetchedAt || '');
  const secondDate = Date.parse(second.pubDate || second.fetchedAt || '');
  const firstTimestamp = Number.isFinite(firstDate) ? firstDate : Number.NEGATIVE_INFINITY;
  const secondTimestamp = Number.isFinite(secondDate) ? secondDate : Number.NEGATIVE_INFINITY;
  if (firstTimestamp === secondTimestamp) return 0;
  return firstTimestamp > secondTimestamp ? -1 : 1;
};

const HOMEPAGE_ROTATION_CATEGORIES: StandardNewsCategory[] = ['arts', 'childcare', 'animals', 'tech', 'world', 'uplifting'];

function effectiveStoryCategory(item: NewsItem): NewsCategory {
  return item.category && isValidCategory(item.category) ? item.category : 'all';
}

export function orderStoriesForHomepage(stories: NewsItem[]): NewsItem[] {
  const rotationBuckets = HOMEPAGE_ROTATION_CATEGORIES.map(category =>
    stories.filter(item => effectiveStoryCategory(item) === category)
  );

  const rotated: NewsItem[] = [];
  for (let index = 0; rotated.length < stories.length; index++) {
    let addedAtThisIndex = false;
    for (const bucket of rotationBuckets) {
      if (index < bucket.length) {
        rotated.push(bucket[index]);
        addedAtThisIndex = true;
      }
    }
    if (!addedAtThisIndex) break;
  }

  const rotatedSet = new Set<NewsItem>(rotated);
  const rest = stories.filter(item => !rotatedSet.has(item));

  return [...rotated, ...rest];
}

export function getCachedNewsFeed(category: NewsCategory): NewsItem[] | null {
  const cacheKey = normalizeCacheKey(category);
  const direct = feedCache.get(cacheKey);
  if (direct && direct.items.length > 0) {
    return direct.items;
  }

  if (isValidCategory(category) && category !== 'all') {
    const raw = rawCategoryCache.get(category.toLowerCase());
    if (raw && raw.items.length > 0) {
      const built = buildCategoryFeedFromRaw(raw.items);
      feedCache.set(cacheKey, { items: built, fetchedAt: raw.fetchedAt });
      return built;
    }
    return null;
  }

  if (!isValidCategory(category)) {
    const trimmedKeyword = String(category || '').trim();
    if (!trimmedKeyword) return null;
    const pool: NewsItem[] = [];
    for (const entry of feedCache.values()) {
      pool.push(...entry.items);
    }
    if (pool.length === 0) return null;
    const seen = new Set<string>();
    const matched: NewsItem[] = [];
    for (const item of pool) {
      if (!item.link || seen.has(item.link)) continue;
      if (storyMatchesKeyword(item, trimmedKeyword)) {
        seen.add(item.link);
        matched.push(item);
      }
    }
    return matched.length > 0 ? matched : null;
  }

  return null;
}

async function searchStoriesByKeyword(
  keyword: string,
  options?: { forceRefresh?: boolean }
): Promise<NewsItem[]> {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return [];

  const parts = trimmedKeyword
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const customParts = parts.filter((p) => !isValidCategory(p));

  const [workerKeywordResults, supabaseDirectResults, ...categoryFeedResults] = await Promise.allSettled([
    Promise.all(customParts.slice(0, 3).map((term) => fetchSingleCategory(term, options).catch(() => [] as NewsItem[]))),
    Promise.all(customParts.slice(0, 3).map((term) => searchSupabaseStoriesByKeyword(term).catch(() => [] as any[]))),
    ...STANDARD_CATEGORIES.map(cat => fetchSingleCategory(cat, { forceRefresh: false }))
  ]);

  const candidatePool: NewsItem[] = [];

  if (workerKeywordResults.status === 'fulfilled') {
    for (const list of workerKeywordResults.value) {
      candidatePool.push(...list);
    }
  }

  if (supabaseDirectResults.status === 'fulfilled') {
    for (const list of supabaseDirectResults.value) {
      candidatePool.push(
        ...list
          .map(item => normalizeFetchedItem(item, item.category || 'all'))
          .filter(isValidStoryItem)
      );
    }
  }

  for (const res of categoryFeedResults) {
    if (res.status === 'fulfilled') {
      candidatePool.push(...res.value.filter(item => storyMatchesKeyword(item, trimmedKeyword)));
    }
  }

  for (const cat of STANDARD_CATEGORIES) {
    const fallbacks = FALLBACK_STORIES[cat] || [];
    for (const fb of fallbacks) {
      if (storyMatchesKeyword(fb, trimmedKeyword)) {
        candidatePool.push({ ...fb, category: fb.category || cat });
      }
    }
  }

  const seenUrls = new Set<string>();
  const approvedMatches: NewsItem[] = [];
  const unapprovedMatches: NewsItem[] = [];

  for (const item of candidatePool) {
    if (!item.link || seenUrls.has(item.link)) continue;
    if (!storyMatchesKeyword(item, trimmedKeyword)) continue;
    seenUrls.add(item.link);
    if (item.approved === true) {
      approvedMatches.push(item);
    } else {
      unapprovedMatches.push(item);
    }
  }

  approvedMatches.sort((a, b) => {
    const aHasImg = a.image && a.image.trim().length > 0 ? 1 : 0;
    const bHasImg = b.image && b.image.trim().length > 0 ? 1 : 0;
    if (aHasImg !== bHasImg) return bHasImg - aHasImg;
    return byPublicationDate(a, b);
  });

  unapprovedMatches.sort(byPublicationDate);

  const combined = [...approvedMatches, ...unapprovedMatches];
  return parts.length > 1 ? orderStoriesForHomepage(combined) : combined;
}

async function fetchNewsFeedInternal(
  category: NewsCategory,
  options?: { forceRefresh?: boolean }
): Promise<NewsItem[]> {
  if (!isValidCategory(category)) {
    const results = await searchStoriesByKeyword(category, options);
    feedCache.set(normalizeCacheKey(category), { items: results, fetchedAt: Date.now() });
    persistCacheToSession();
    return results;
  }

  try {
    if (category === 'all') {
      const otherCategories: StandardNewsCategory[] = ['childcare', 'animals', 'arts', 'tech', 'world', 'uplifting'];
      const [allFeedResult, ...otherCategoryResults] = await Promise.allSettled([
        fetchSingleCategory('all', options),
        ...otherCategories.map(cat => fetchSingleCategory(cat, options))
      ]);

      const baseItems: NewsItem[] = allFeedResult.status === 'fulfilled' ? allFeedResult.value : [];
      const extraApproved: NewsItem[] = [];

      for (const res of otherCategoryResults) {
        if (res.status === 'fulfilled') {
          extraApproved.push(...res.value.filter(item => item.approved === true));
        }
      }

      const seenUrls = new Set<string>();
      const combinedApproved: NewsItem[] = [];
      const combinedUnapproved: NewsItem[] = [];

      const allApprovedStories = [...baseItems.filter(i => i.approved === true), ...extraApproved];

      for (const item of allApprovedStories) {
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          combinedApproved.push(item);
        }
      }

      for (const item of baseItems.filter(i => i.approved !== true)) {
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          combinedUnapproved.push(item);
        }
      }

      const merged = [...combinedApproved, ...combinedUnapproved];
      const finalAll = merged.length > 0
        ? orderStoriesForHomepage(merged)
        : (FALLBACK_STORIES.all || []);

      feedCache.set(normalizeCacheKey('all'), { items: finalAll, fetchedAt: Date.now() });
      persistCacheToSession();
      return finalAll;
    }

    const feedItems = await fetchSingleCategory(category, options);
    if (!feedItems.length) {
      throw new Error(`News feed returned no stories for category: ${category}`);
    }

    const merged = buildCategoryFeedFromRaw(feedItems);
    const finalCat = merged.length > 0 ? merged : (FALLBACK_STORIES[category] || FALLBACK_STORIES.all);

    feedCache.set(normalizeCacheKey(category), { items: finalCat, fetchedAt: Date.now() });
    persistCacheToSession();
    return finalCat;
  } catch (err) {
    console.warn('Fetch news feed returned error, using fallback curated stories:', err);
    return FALLBACK_STORIES[category] || FALLBACK_STORIES.all;
  }
}

export async function fetchNewsFeed(
  category: NewsCategory,
  options?: { forceRefresh?: boolean }
): Promise<NewsItem[]> {
  const cacheKey = normalizeCacheKey(category);
  const forceRefresh = options?.forceRefresh === true;
  const cached = feedCache.get(cacheKey);

  if (!forceRefresh && cached && cached.items.length > 0) {
    const age = Date.now() - cached.fetchedAt;
    if (age < RAW_CATEGORY_TTL_MS) {
      return cached.items;
    }
  }

  const existing = inFlightFeedRequests.get(cacheKey);
  if (!forceRefresh && existing) {
    return existing;
  }

  const promise = fetchNewsFeedInternal(category, options);
  inFlightFeedRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightFeedRequests.delete(cacheKey);
  }
}

export function prefetchCategoriesInBackground(extraTopics: NewsCategory[] = []): void {
  if (typeof window === 'undefined') return;
  const runPrefetch = () => {
    const targets: NewsCategory[] = [...STANDARD_CATEGORIES, ...extraTopics];
    const seen = new Set<string>();
    for (const topic of targets) {
      const key = normalizeCacheKey(topic);
      if (seen.has(key)) continue;
      seen.add(key);
      const cached = feedCache.get(key);
      if (cached && Date.now() - cached.fetchedAt < RAW_CATEGORY_TTL_MS) {
        continue;
      }
      fetchNewsFeed(topic).catch(() => {});
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runPrefetch, { timeout: 1500 });
  } else {
    setTimeout(runPrefetch, 250);
  }
}

export async function fetchKeywordFeed(keywordId: string): Promise<NewsItem[]> {
  const cacheKey = `keyword:${keywordId.trim().toLowerCase()}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < RAW_CATEGORY_TTL_MS) {
    return cached.items;
  }

  try {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/space';
    url.searchParams.set('keyword', keywordId);
    let response = await fetch(url.href);
    if (response.status === 404) {
      const legacyUrl = new URL(NEWS_CONFIG.workerUrl);
      legacyUrl.pathname = '/feed';
      legacyUrl.searchParams.set('keyword', keywordId);
      response = await fetch(legacyUrl.href);
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Keyword feed request failed (HTTP ${response.status})`);
    }
    if (!Array.isArray(data.items)) return [];
    const items = data.items
      .filter((item: any) => item && typeof (item.link || item.article_url) === 'string')
      .map((item: any) => normalizeFetchedItem(item, 'all'));
    const approved = items.filter((i: NewsItem) => i.approved === true).sort(byPublicationDate);
    const unapproved = items.filter((i: NewsItem) => i.approved !== true).sort(byPublicationDate);
    const merged = [...approved, ...unapproved];
    feedCache.set(cacheKey, { items: merged, fetchedAt: Date.now() });
    return merged;
  } catch (err) {
    console.warn('Fetch keyword feed returned error:', err);
    return [];
  }
}

