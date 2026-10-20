import { NewsCategory, NewsItem } from '../types';
import { NEWS_CONFIG, CATEGORY_STOCK_IMAGES, FALLBACK_STORIES } from '../constants/config';

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

  const effectiveCategory = item.category || category;
  const pool = CATEGORY_STOCK_IMAGES[effectiveCategory] || CATEGORY_STOCK_IMAGES.all;
  return pool[index % pool.length];
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
    .filter((item: any) => item && typeof item.link === 'string')
    .map((item: any) => ({
      ...item,
      title: decodeHtmlEntities(item.title),
      link: decodeHtmlEntities(item.link || item.article_url),
      image: decodeHtmlEntities(item.image || item.imageUrl || item.image_url),
      description: decodeHtmlEntities(item.description),
      aiSummary: decodeHtmlEntities(item.aiSummary),
      category: item.category || category
    }))
    .filter((item: NewsItem) => {
      if (!item || typeof item.title !== 'string' || typeof item.link !== 'string') return false;
      try {
        return ['http:', 'https:'].includes(new URL(item.link).protocol);
      } catch {
        return false;
      }
    });
}

export async function fetchNewsFeed(category: NewsCategory): Promise<NewsItem[]> {
  try {
    const byPublicationDate = (first: NewsItem, second: NewsItem) => {
      const firstDate = Date.parse(first.pubDate || first.fetchedAt || '');
      const secondDate = Date.parse(second.pubDate || second.fetchedAt || '');
      const firstTimestamp = Number.isFinite(firstDate) ? firstDate : Number.NEGATIVE_INFINITY;
      const secondTimestamp = Number.isFinite(secondDate) ? secondDate : Number.NEGATIVE_INFINITY;
      if (firstTimestamp === secondTimestamp) return 0;
      return firstTimestamp > secondTimestamp ? -1 : 1;
    };

    if (category === 'all') {
      // For the homepage, fetch "all" and in parallel fetch approved/custom stories
      // from other categories so custom images and curated stories show on the homepage!
      const otherCategories: NewsCategory[] = ['childcare', 'animals', 'arts', 'tech', 'world', 'uplifting'];
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

      // 1. First add all approved stories (from all and other categories), prioritizing ones with custom images
      const allApprovedStories = [...baseItems.filter(i => i.approved === true), ...extraApproved];
      allApprovedStories.sort((a, b) => {
        // Prioritize stories that have custom images
        const aHasImg = a.image && a.image.trim().length > 0 ? 1 : 0;
        const bHasImg = b.image && b.image.trim().length > 0 ? 1 : 0;
        if (aHasImg !== bHasImg) return bHasImg - aHasImg;
        return byPublicationDate(a, b);
      });

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
      return merged.length > 0 ? merged : (FALLBACK_STORIES.all || []);
    }

    // Specific category feed
    const feedItems = await fetchSingleCategory(category);
    if (!feedItems.length) {
      throw new Error(`News feed returned no stories for category: ${category}`);
    }

    const approvedItems = feedItems
      .filter(item => item.approved === true)
      .sort(byPublicationDate);

    const unapprovedItems = feedItems
      .filter(item => item.approved !== true)
      .sort(byPublicationDate);

    const merged = [...approvedItems, ...unapprovedItems];
    return merged.length > 0 ? merged : (FALLBACK_STORIES[category] || FALLBACK_STORIES.all);
  } catch (err) {
    console.warn('Fetch news feed returned error, using fallback curated stories:', err);
    return FALLBACK_STORIES[category] || FALLBACK_STORIES.all;
  }
}
