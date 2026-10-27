import { NewsCategory, StandardNewsCategory, AdItem } from '../types';
import { NEWS_CONFIG } from '../constants/config';
import { isValidCategory, matchesKeywordQuery } from './urlService';
import { searchSupabaseAdsByKeyword } from './supabaseService';

interface RawProductAd {
  name?: string;
  title?: string;
  description?: string;
  desc?: string;
  thumbnailUrl?: string;
  img?: string;
  url?: string;
  sellerName?: string;
  sponsor?: string;
  priceUsd?: number;
  priceCents?: number;
  currency?: string;
  cta?: string;
  category?: string;
  network?: string;
}

const adCache: Record<string, AdItem[]> = {};

/** Categories whose catalogs are sampled to build the frontpage ad pool. */
const FRONT_PAGE_AD_CATEGORIES: NewsCategory[] = [
  'childcare',
  'animals',
  'arts',
  'tech',
  'world',
  'uplifting'
];
/** How many ads to sample from each category catalog for the frontpage. */
const FRONT_PAGE_ADS_PER_CATEGORY = 5;
/** How many TikTok affiliate ads to include on the frontpage for variety. */
const FRONT_PAGE_TIKTOK_ADS = 5;

const ALL_AD_JSON_FILES = [
  'ads/childcare.json',
  'ads/animals.json',
  'ads/arts.json',
  'ads/tech.json',
  'ads/world.json',
  'ads/uplifting.json',
  'ads/amazon.json',
  'ads/tiktok.json'
];

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * VRChat avatar ads are brand-risky for a family audience, so they are always
 * served last — after every other ad in the pool has had its turn.
 * (They were removed from the catalogs in Oct 2026; this is a guard in case
 * a future catalog sync reintroduces them.)
 */
function isVrChatAd(ad: AdItem): boolean {
  return /vrchat|vrcft|vrcfury|\bvrc\b|rexouium|dante/i.test(`${ad.title} ${ad.desc}`);
}

/** Stable partition: all non-VRChat ads first (order preserved), VRChat ads last. */
function deprioritizeVrChatAds(ads: AdItem[]): AdItem[] {
  const normal: AdItem[] = [];
  const vrChat: AdItem[] = [];
  for (const ad of ads) {
    (isVrChatAd(ad) ? vrChat : normal).push(ad);
  }
  return [...normal, ...vrChat];
}

function resolveFallbackAdCategory(rawCategory?: string, fallbackCategory?: NewsCategory): StandardNewsCategory {
  if (rawCategory && isValidCategory(rawCategory)) return rawCategory;
  if (fallbackCategory && isValidCategory(fallbackCategory)) return fallbackCategory;
  return 'all';
}

function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// Ad data carries relative image paths (e.g. "img/ads/...", "ads/img/...").
// Rendered raw into <img src>, those resolve against the current route path,
// so on deep routes like /@user/... the browser requests /@user/img/... and the
// SPA fallback serves index.html instead of the image. Root-absolute works everywhere.
function toRootAbsolute(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/') || path.startsWith('data:')) return path;
  return `/${path.replace(/^\.\//, '')}`;
}

function formatProductAd(raw: RawProductAd, category: NewsCategory, defaultIndex: number): AdItem {
  const title = raw.name || raw.title || 'Curated Discovery';
  const desc = raw.description || raw.desc || 'A handpicked resource tailored to your interests.';
  const imgCat = resolveFallbackAdCategory(raw.category, category);
  const img = toRootAbsolute(raw.thumbnailUrl || raw.img || `img/${imgCat}_${(defaultIndex % 10) + 1}.jpg`);
  const sponsor = raw.sellerName || raw.sponsor || 'Featured Partner';
  const url = raw.url || '#';
  const price = raw.priceUsd != null && raw.priceUsd > 0
    ? `$${raw.priceUsd}`
    : (raw.priceCents != null && raw.priceCents > 0
      ? `$${(raw.priceCents / 100).toFixed(2)}`
      : 'Free');
  const cta = raw.cta || (price === 'Free' ? 'Explore Free →' : `Get for ${price} →`);

  // Stable ID: network + hash of URL (or title+sponsor as fallback)
  const network = raw.network || 'unknown';
  const idSeed = url !== '#' ? url : `${title}|${sponsor}`;
  const id = `ad_${network}_${hashString(idSeed)}`;

  return {
    id,
    title,
    desc,
    img,
    cta,
    sponsor,
    url,
    category: raw.category || imgCat,
    network
  };
}

const jsonFileCache: Record<string, RawProductAd[]> = {};

async function fetchJsonAdsFromPath(basePath: string): Promise<RawProductAd[]> {
  const normalizedKey = basePath.replace(/^\.?\/+/, '');
  if (jsonFileCache[normalizedKey]) {
    return jsonFileCache[normalizedKey];
  }
  const candidates = [basePath, `/${normalizedKey}`, `./${normalizedKey}`];
  for (const path of candidates) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          jsonFileCache[normalizedKey] = data;
          return data;
        }
      }
    } catch {
      // Try next candidate
    }
  }
  return [];
}

/** Try each candidate path in order, returning the first non-empty ad list. */
async function fetchFirstAvailableJson(paths: string[]): Promise<RawProductAd[]> {
  for (const path of paths) {
    const ads = await fetchJsonAdsFromPath(path);
    if (ads.length > 0) return ads;
  }
  return [];
}

/**
 * Build a balanced frontpage ad pool by sampling from every category catalog
 * instead of relying on ads/all.json, which had become ~80% pet products.
 * Result: 5 per category x 6 categories (Gumroad) + Amazon general ads +
 * a few TikTok affiliate ads, all shuffled together.
 */
async function fetchFrontPageAds(): Promise<AdItem[]> {
  const [perCategory, amazonAds, tiktokAds, awinAds] = await Promise.all([
    Promise.all(FRONT_PAGE_AD_CATEGORIES.map((cat) => fetchFirstAvailableJson([`ads/${cat}.json`]))),
    fetchFirstAvailableJson(['ads/amazon.json']),
    fetchFirstAvailableJson(['ads/tiktok.json']),
    fetchAwinAds('all'),
  ]);

  // Pre-populate individual category ad caches using the already-fetched category + amazon + tiktok catalogs
  FRONT_PAGE_AD_CATEGORIES.forEach((cat, idx) => {
    if (!adCache[cat] || adCache[cat].length === 0) {
      const catRaw = [
        ...(perCategory[idx] || []),
        ...amazonAds.filter((ad) => ad.category === cat || ad.category === 'all'),
        ...shuffleArray(tiktokAds).slice(0, 2),
      ];
      if (catRaw.length > 0) {
        const formatted = catRaw.map((item, i) => formatProductAd(item, cat as NewsCategory, i));
        adCache[cat] = deprioritizeVrChatAds(shuffleArray(formatted));
      }
    }
  });

  const sampled: RawProductAd[] = [];
  for (const ads of perCategory) {
    sampled.push(...shuffleArray(ads).slice(0, FRONT_PAGE_ADS_PER_CATEGORY));
  }

  // Amazon general-interest ads (category 'all')
  sampled.push(...amazonAds.filter((ad) => ad.category === 'all'));

  // A few TikTok affiliate ads for extra variety
  sampled.push(...shuffleArray(tiktokAds).slice(0, FRONT_PAGE_TIKTOK_ADS));

  // Awin affiliate ads (from Supabase via the worker) for extra variety
  sampled.push(...shuffleArray(awinAds).slice(0, 5));

  return sampled.map((item, idx) => formatProductAd(item, 'all', idx));
}

async function fetchWorkerAdsByKeyword(keyword: string): Promise<RawProductAd[]> {
  try {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/ads';
    url.searchParams.set('q', keyword);
    const response = await fetch(url.href);
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data?.ads)) return data.ads;
  } catch {
    // Worker /ads endpoint optional fallback
  }
  return [];
}

const awinCache: Record<string, RawProductAd[]> = {};

/** Fetch Awin affiliate ads from the worker (served from Supabase). */
async function fetchAwinAds(category: string): Promise<RawProductAd[]> {
  if (awinCache[category]) return awinCache[category];
  try {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/ads';
    url.searchParams.set('category', category);
    url.searchParams.set('network', 'awin');
    const response = await fetch(url.href);
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data?.ads)) {
      awinCache[category] = data.ads;
      return data.ads;
    }
  } catch {
    // Awin ads are optional — the site works without them
  }
  return [];
}

function adMatchesKeyword(ad: AdItem, raw: RawProductAd | undefined, keyword: string): boolean {
  const searchable = [
    ad.title,
    ad.desc,
    ad.sponsor,
    ad.cta,
    ad.category,
    ad.url,
    raw?.network,
    raw?.category
  ]
    .filter(Boolean)
    .join(' ');

  return matchesKeywordQuery(searchable, keyword);
}

/**
 * Searches all ad catalogs, the Cloudflare Worker ads endpoint, and Supabase ads table
 * for ads matching the custom topic keyword.
 */
async function searchAdsByKeyword(keyword: string): Promise<AdItem[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const cacheKey = `custom:${trimmed.toLowerCase()}`;
  if (adCache[cacheKey]) {
    return adCache[cacheKey];
  }

  const [workerAdsResult, supabaseAdsResult, ...jsonFileResults] = await Promise.allSettled([
    fetchWorkerAdsByKeyword(trimmed),
    searchSupabaseAdsByKeyword(trimmed),
    ...ALL_AD_JSON_FILES.map(file => fetchJsonAdsFromPath(file))
  ]);

  const rawPool: RawProductAd[] = [];
  if (workerAdsResult.status === 'fulfilled') {
    rawPool.push(...workerAdsResult.value);
  }
  if (supabaseAdsResult.status === 'fulfilled') {
    rawPool.push(...supabaseAdsResult.value);
  }
  for (const res of jsonFileResults) {
    if (res.status === 'fulfilled') {
      rawPool.push(...res.value);
    }
  }

  const seenKeys = new Set<string>();
  const matchedAds: AdItem[] = [];

  rawPool.forEach((raw, idx) => {
    const formatted = formatProductAd(raw, 'all', idx);
    const dedupeKey = `${(formatted.url || '').toLowerCase()}|${formatted.title.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) return;
    if (adMatchesKeyword(formatted, raw, trimmed)) {
      seenKeys.add(dedupeKey);
      matchedAds.push(formatted);
    }
  });

  adCache[cacheKey] = matchedAds;
  return matchedAds;
}

/**
 * Synchronously returns cached ads for a category if already loaded in memory.
 */
export function getCachedAdsForCategory(category: NewsCategory): AdItem[] | null {
  if (!isValidCategory(category)) {
    const cacheKey = `custom:${category.trim().toLowerCase()}`;
    return adCache[cacheKey] || null;
  }
  if (adCache[category] && adCache[category].length > 0) {
    return deprioritizeVrChatAds(shuffleArray(adCache[category]));
  }
  return null;
}

export async function fetchAdsForCategory(category: NewsCategory): Promise<AdItem[]> {
  if (!isValidCategory(category)) {
    return searchAdsByKeyword(category);
  }

  if (adCache[category] && adCache[category].length > 0) {
    // Return a newly shuffled copy each time to ensure unbiased random presentation,
    // keeping VRChat ads pinned to the end.
    return deprioritizeVrChatAds(shuffleArray(adCache[category]));
  }

  // The frontpage gets a balanced mix sampled from every category catalog
  // instead of the pet-heavy ads/all.json.
  if (category === 'all') {
    const frontPageAds = await fetchFrontPageAds();
    if (frontPageAds.length > 0) {
      const mixed = deprioritizeVrChatAds(shuffleArray(frontPageAds));
      adCache[category] = mixed;
      return mixed;
    }
    // Fall through to the category file lookup if sampling produced nothing.
  }

  const lookupPaths = [
    `ads/${category}.json`,
    `/ads/${category}.json`,
    `./ads/${category}.json`
  ];

  let rawAds: RawProductAd[] = [];

  // 1. Load Gumroad products for category (no all.json fallback — an empty
  // catalog should not fall back to the pet-heavy general file)
  for (const path of lookupPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data: RawProductAd[] = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          rawAds = data;
          break;
        }
      }
    } catch {
      // Try next path
    }
  }

  // 2. Load Amazon search affiliate ads for category (5 searches per category with tag=littlables-20)
  const amazonPaths = ['ads/amazon.json', '/ads/amazon.json', './ads/amazon.json'];
  for (const aPath of amazonPaths) {
    try {
      const aResponse = await fetch(aPath);
      if (aResponse.ok) {
        const aData: RawProductAd[] = await aResponse.json();
        if (Array.isArray(aData) && aData.length > 0) {
          const categoryAmazonAds = aData.filter(ad => ad.category === category);
          if (categoryAmazonAds.length > 0) {
            rawAds = [...rawAds, ...categoryAmazonAds];
          }
          break;
        }
      }
    } catch {
      // Continue
    }
  }

  // 3. Load TikTok affiliate ads for Creative Arts and Future Tech & AI
  if (category === 'arts' || category === 'tech') {
    const tiktokPaths = ['ads/tiktok.json', '/ads/tiktok.json', './ads/tiktok.json'];
    for (const tPath of tiktokPaths) {
      try {
        const tResponse = await fetch(tPath);
        if (tResponse.ok) {
          const tData: RawProductAd[] = await tResponse.json();
          if (Array.isArray(tData) && tData.length > 0) {
            // Append TikTok ads into the pool
            rawAds = [...rawAds, ...tData];
            break;
          }
        }
      } catch {
        // Continue
      }
    }
  }

  // 4. Load Awin affiliate ads for category (from Supabase via the worker)
  const awinAds = await fetchAwinAds(category);
  if (awinAds.length > 0) {
    rawAds = [...rawAds, ...awinAds];
  }

  if (rawAds.length > 0) {
    const parsed = rawAds.map((item, idx) => formatProductAd(item, category, idx));
    // Completely and randomly mix all the ads (Gumroad, Amazon, TikTok, Awin) together,
    // with VRChat ads pinned to the end.
    const mixed = deprioritizeVrChatAds(shuffleArray(parsed));
    adCache[category] = mixed;
    return mixed;
  }

  // Fallback ad if none could be loaded
  return [
    {
      title: 'Family Learning & Creative Discovery Set',
      desc: 'Interactive educational printables, cozy activities, and sensory tools designed for mindful curious minds.',
      img: `img/${category}_1.jpg`,
      cta: 'Explore Bundle →',
      sponsor: 'Littlables Showcase',
      url: '#'
    }
  ];
}

export function getRandomAds(ads: AdItem[], count: number = 2): AdItem[] {
  if (!ads || !ads.length) return [];
  // Completely randomize and shuffle all ads for the category together,
  // keeping VRChat ads pinned to the end.
  const mixed = deprioritizeVrChatAds(shuffleArray(ads));
  return mixed.slice(0, count);
}

/** Cached ad keyword tags: ad_id -> keyword ids. Fetched once per session. */
let adTagsCache: Record<string, string[]> | null = null;
let adTagsCacheKey = '';

/**
 * Fetch keyword tags for ads matching the given story keywords.
 * Hits GET /ads/tags?keywords=... on the worker; results are cached
 * per keyword-set for the session. Returns {} on failure.
 */
export async function fetchAdKeywordTags(keywords: string[]): Promise<Record<string, string[]>> {
  const key = [...keywords].sort().join(',');
  if (adTagsCache && adTagsCacheKey === key) return adTagsCache;
  try {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/ads/tags';
    if (keywords.length) url.searchParams.set('keywords', keywords.join(','));
    const response = await fetch(url.href);
    if (!response.ok) throw new Error('tags fetch failed');
    const data = await response.json();
    const tags: Record<string, string[]> = data?.tags || {};
    adTagsCache = tags;
    adTagsCacheKey = key;
    return tags;
  } catch {
    return {};
  }
}

/**
 * Match ads to stories server-side.
 * POST /ads/match classifies untagged stories, queries the tags table,
 * ranks via matchAdsToStory, and returns ranked ad IDs per story index.
 * Frontend looks up ad content by ID from its JSON cache.
 * Returns { [storyIndex]: adId[] }. Empty on failure (fallback to rotation).
 */
export async function fetchMatchedAdIds(
  stories: { title?: string; description?: string; keywords?: string[]; interest_keywords?: string[]; interestKeywords?: string[] }[]
): Promise<Record<number, string[]>> {
  try {
    const url = new URL(NEWS_CONFIG.workerUrl);
    url.pathname = '/ads/match';
    const payload = {
      stories: stories.slice(0, 20).map(s => ({
        title: s.title || '',
        description: s.description || '',
        keywords: s.keywords || s.interest_keywords || s.interestKeywords || [],
      })),
    };
    const response = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('match failed');
    const data = await response.json();
    return data?.matches || {};
  } catch {
    return {};
  }
}

/**
 * Merge keyword tags onto ads by ID (mutates copies, not the originals).
 */
export function applyAdKeywordTags(ads: AdItem[], tags: Record<string, string[]>): AdItem[] {
  return ads.map((ad) => {
    if (!ad.id || !tags[ad.id]) return ad;
    return { ...ad, keywords: tags[ad.id] };
  });
}

/**
 * Get keyword-matched ads for a story, best match first.
 * Falls back to the input order (category-based) when no keywords match.
 */
export async function getMatchedAdsForStory(
  story: { interest_keywords?: string[]; interestKeywords?: string[]; category?: string },
  ads: AdItem[],
  count: number = 2
): Promise<AdItem[]> {
  if (!ads || !ads.length) return [];
  const storyKeywords = story?.interest_keywords || story?.interestKeywords || [];
  // Only fetch tags for this story's keywords — smaller payload, scales better.
  const tags = await fetchAdKeywordTags(storyKeywords);
  const taggedAds = applyAdKeywordTags(ads, tags);
  const { matchAdsToStory } = await import('./adKeywordMatcher');
  const matched = matchAdsToStory(story, taggedAds);
  if (matched.length > 0) {
    return matched.slice(0, count);
  }
  // No keyword matches: fall back to shuffled category ads
  return getRandomAds(ads, count);
}
