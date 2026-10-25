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
    if (candidate.startsWith('/') || candidate.startsWith('img/') || candidate.startsWith('./')) {
      return candidate;
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

function normalizeFetchedItem(item: any, defaultCategory: NewsCategory): NewsItem {
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

async function fetchSingleCategory(category: NewsCategory): Promise<NewsItem[]> {
  const url = new URL(NEWS_CONFIG.workerUrl);
  url.pathname = '/feed';
  url.searchParams.set('category', category);

  const response = await fetch(url.href, { cache: 'no-cache' });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `News feed request failed (HTTP ${response.status})`);
  }

  if (!Array.isArray(data.items)) return [];

  return data.items
    .filter((item: any) => item && typeof (item.link || item.article_url) === 'string')
    .map((item: any) => {
      const normalized = normalizeFetchedItem(item, category);
      // When viewing a specific category feed, label the card with the viewed
      // category if the story's override list includes it.
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
}

function storyMatchesKeyword(item: NewsItem, keyword: string): boolean {
  const searchable = [
    item.title,
    item.description,
    item.aiSummary,
    item.content,
    item.source,
    item.provider,
    item.category
  ]
    .filter(Boolean)
    .join(' ');

  return matchesKeywordQuery(searchable, keyword);
}

const byPublicationDate = (first: NewsItem, second: NewsItem) => {
  const firstDate = Date.parse(first.pubDate || first.fetchedAt || '');
  const secondDate = Date.parse(second.pubDate || second.fetchedAt || '');
  const firstTimestamp = Number.isFinite(firstDate) ? firstDate : Number.NEGATIVE_INFINITY;
  const secondTimestamp = Number.isFinite(secondDate) ? secondDate : Number.NEGATIVE_INFINITY;
  if (firstTimestamp === secondTimestamp) return 0;
  return firstTimestamp > secondTimestamp ? -1 : 1;
};

/**
 * Homepage ('all') ordering.
 *
 * A first-time visitor (and anyone reviewing the site, e.g. an advertiser
 * brand manager) judges Littlables from the first cards they see with zero
 * clicks. Those cards should show what the site is for — cozy lifestyle and
 * creative stories — not the newest breaking / political headline from the
 * wire, which can be the freshest item even when it is off-brand.
 *
 * So for the default landing feed only:
 *  1. Rotate through all six front-page categories — Creative Arts,
 *     Childcare & Family, Animals & Nature, Future Tech, Global Currents,
 *     and Uplifting News — so every category gets turns at the top
 *     instead of the slower ones sitting below the whole feed.
 *  2. Show uncategorised stories (the 'all' wire) afterwards, in their
 *     existing order.
 *
 * Within each category the incoming order is preserved (the worker's
 * reaction-ranked order). Category-specific feeds are unaffected.
 */
const HOMEPAGE_ROTATION_CATEGORIES: StandardNewsCategory[] = ['arts', 'childcare', 'animals', 'tech', 'world', 'uplifting'];

function effectiveStoryCategory(item: NewsItem): NewsCategory {
  return item.category && isValidCategory(item.category) ? item.category : 'all';
}

export function orderStoriesForHomepage(stories: NewsItem[]): NewsItem[] {
  const rotationBuckets = HOMEPAGE_ROTATION_CATEGORIES.map(category =>
    stories.filter(item => effectiveStoryCategory(item) === category)
  );

  // Round-robin all six categories: arts, childcare, animals, tech, world,
  // uplifting, arts, ... so every category gets turns at the top.
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

/**
 * Searches the story table across the Worker endpoint, Supabase table, and all category feeds
 * for a custom topic keyword.
 */
async function searchStoriesByKeyword(keyword: string): Promise<NewsItem[]> {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) return [];

  const [workerKeywordResult, supabaseDirectResult, ...categoryFeedResults] = await Promise.allSettled([
    fetchSingleCategory(trimmedKeyword),
    searchSupabaseStoriesByKeyword(trimmedKeyword),
    ...STANDARD_CATEGORIES.map(cat => fetchSingleCategory(cat))
  ]);

  const candidatePool: NewsItem[] = [];

  if (workerKeywordResult.status === 'fulfilled') {
    candidatePool.push(...workerKeywordResult.value);
  }

  if (supabaseDirectResult.status === 'fulfilled') {
    candidatePool.push(
      ...supabaseDirectResult.value
        .map(item => normalizeFetchedItem(item, item.category || 'all'))
        .filter(isValidStoryItem)
    );
  }

  for (const res of categoryFeedResults) {
    if (res.status === 'fulfilled') {
      candidatePool.push(...res.value.filter(item => storyMatchesKeyword(item, trimmedKeyword)));
    }
  }

  // Also check fallback stories in case they match the keyword
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

  return [...approvedMatches, ...unapprovedMatches];
}

export async function fetchNewsFeed(category: NewsCategory): Promise<NewsItem[]> {
  if (!isValidCategory(category)) {
    return searchStoriesByKeyword(category);
  }

  try {
    if (category === 'all') {
      // For the homepage, fetch "all" and in parallel fetch approved/custom stories
      // from other categories so custom images and curated stories show on the homepage!
      const otherCategories: StandardNewsCategory[] = ['childcare', 'animals', 'arts', 'tech', 'world', 'uplifting'];
      const [allFeedResult, ...otherCategoryResults] = await Promise.allSettled([
        fetchSingleCategory('all'),
        ...otherCategories.map(cat => fetchSingleCategory(cat))
      ]);

      const baseItems: NewsItem[] = allFeedResult.status === 'fulfilled' ? allFeedResult.value : [];
      const extraApproved: NewsItem[] = [];

      for (const res of otherCategoryResults) {
        if (res.status === 'fulfilled') {
          // Include all approved stories curated from other categories
          extraApproved.push(...res.value.filter(item => item.approved === true));
        }
      }

      const seenUrls = new Set<string>();
      const combinedApproved: NewsItem[] = [];
      const combinedUnapproved: NewsItem[] = [];

      // 1. First add all approved stories (from all and other categories),
      // preserving the worker's reaction-ranked order. No re-sort here: a
      // date or image sort would undo within-day reaction ranking.
      const allApprovedStories = [...baseItems.filter(i => i.approved === true), ...extraApproved];

      for (const item of allApprovedStories) {
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          combinedApproved.push(item);
        }
      }

      // 2. Add unapproved stories to keep the wire fresh
      for (const item of baseItems.filter(i => i.approved !== true)) {
        if (!seenUrls.has(item.link)) {
          seenUrls.add(item.link);
          combinedUnapproved.push(item);
        }
      }

      const merged = [...combinedApproved, ...combinedUnapproved];
      return merged.length > 0
        ? orderStoriesForHomepage(merged)
        : (FALLBACK_STORIES.all || []);
    }

    // Specific category feed
    const feedItems = await fetchSingleCategory(category);
    if (!feedItems.length) {
      throw new Error(`News feed returned no stories for category: ${category}`);
    }

    // Preserve the worker's reaction-ranked order: filtering keeps order,
    // so no re-sort here (a date sort would undo within-day ranking).
    const approvedItems = feedItems
      .filter(item => item.approved === true);

    const unapprovedItems = feedItems
      .filter(item => item.approved !== true);

    const merged = [...approvedItems, ...unapprovedItems];
    return merged.length > 0 ? merged : (FALLBACK_STORIES[category] || FALLBACK_STORIES.all);
  } catch (err) {
    console.warn('Fetch news feed returned error, using fallback curated stories:', err);
    return FALLBACK_STORIES[category] || FALLBACK_STORIES.all;
  }
}

/**
 * Fetch stories tagged with an interest keyword (for custom boards).
 * Interest keywords never appear as categories; the worker serves them
 * via /feed?keyword=.
 */
export async function fetchKeywordFeed(keywordId: string): Promise<NewsItem[]> {
  try {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/feed';
    url.searchParams.set('keyword', keywordId);
    const response = await fetch(url.href, { cache: 'no-cache' });
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
    return [...approved, ...unapproved];
  } catch (err) {
    console.warn('Fetch keyword feed returned error:', err);
    return [];
  }
}
