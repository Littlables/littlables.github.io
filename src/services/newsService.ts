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

export function resolveImageUrl(item: NewsItem, index: number, category: NewsCategory): string {
  if (item.image && item.image.startsWith('http')) return item.image;
  if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
  if (item.enclosure?.link && item.enclosure.link.startsWith('http')) return item.enclosure.link;

  if (item.description) {
    const match = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match && match[1] && match[1].startsWith('http')) return match[1];
  }

  const pool = CATEGORY_STOCK_IMAGES[category] || CATEGORY_STOCK_IMAGES.all;
  return pool[index % pool.length];
}

export async function fetchNewsFeed(category: NewsCategory): Promise<NewsItem[]> {
  const url = new URL(NEWS_CONFIG.workerUrl);
  url.pathname = '/feed';
  url.searchParams.set('category', category);

  try {
    const response = await fetch(url.href, { cache: 'no-cache' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `News feed request failed (HTTP ${response.status})`);
    }

    const feedItems: NewsItem[] = Array.isArray(data.items)
      ? data.items
        .filter((item: any) => item && typeof item.link === 'string')
        .map((item: any) => ({
          ...item,
          title: decodeHtmlEntities(item.title),
          link: decodeHtmlEntities(item.link),
          image: decodeHtmlEntities(item.image),
          description: decodeHtmlEntities(item.description),
          aiSummary: decodeHtmlEntities(item.aiSummary)
        }))
        .filter((item: NewsItem) => {
          if (!item || typeof item.title !== 'string' || typeof item.link !== 'string') return false;
          try {
            return ['http:', 'https:'].includes(new URL(item.link).protocol);
          } catch {
            return false;
          }
        })
      : [];

    if (!feedItems.length) {
      throw new Error('News feed returned no stories with valid article links');
    }

    const byPublicationDate = (first: NewsItem, second: NewsItem) => {
      const firstDate = Date.parse(first.pubDate || first.fetchedAt || '');
      const secondDate = Date.parse(second.pubDate || second.fetchedAt || '');
      const firstTimestamp = Number.isFinite(firstDate) ? firstDate : Number.NEGATIVE_INFINITY;
      const secondTimestamp = Number.isFinite(secondDate) ? secondDate : Number.NEGATIVE_INFINITY;
      if (firstTimestamp === secondTimestamp) return 0;
      return firstTimestamp > secondTimestamp ? -1 : 1;
    };

    const approvedItems = feedItems
      .filter(item => item.approved === true)
      .sort(byPublicationDate)
      .slice(0, NEWS_CONFIG.maxStories);

    const unapprovedItems = feedItems
      .filter(item => item.approved !== true)
      .sort(byPublicationDate)
      .slice(0, NEWS_CONFIG.maxStories);

    const merged = [...approvedItems, ...unapprovedItems];
    return merged.length > 0 ? merged : (FALLBACK_STORIES[category] || FALLBACK_STORIES.all);
  } catch (err) {
    console.warn('Fetch news feed returned error, using fallback curated stories:', err);
    return FALLBACK_STORIES[category] || FALLBACK_STORIES.all;
  }
}
