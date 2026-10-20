import { NewsCategory, NewsItem } from '../types';
import { CATEGORIES } from '../constants/config';
import { getStoryId } from './supabaseService';

const VALID_CATEGORIES = new Set<NewsCategory>(CATEGORIES.map(c => c.id));

export function isValidCategory(value: string | null | undefined): value is NewsCategory {
  if (!value) return false;
  return VALID_CATEGORIES.has(value.toLowerCase() as NewsCategory);
}

/**
 * Generates a URL-safe readable slug combined with the deterministic story ID
 * so story URLs are both human-readable and uniquely identifiable.
 */
export function getStorySlug(item: NewsItem): string {
  const storyId = getStoryId(item.title, item.link);
  const titleSlug = (item.title || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
    .replace(/-+$/g, '');

  return titleSlug ? `${storyId}-${titleSlug}` : storyId;
}

/**
 * Checks if a story matches the `story` parameter from the URL.
 */
export function matchesStoryParam(item: NewsItem, storyParam: string | null | undefined): boolean {
  if (!storyParam) return false;
  const cleanParam = decodeURIComponent(storyParam).trim();
  if (!cleanParam) return false;

  const fullSlug = getStorySlug(item);
  if (fullSlug === cleanParam) return true;

  const storyId = getStoryId(item.title, item.link);
  if (storyId === cleanParam || cleanParam.startsWith(`${storyId}-`)) return true;

  if (item.link && item.link === cleanParam) return true;
  return false;
}

/**
 * Builds the relative href for a topic so links work on both root and subpaths.
 */
export function getTopicHref(category: NewsCategory): string {
  if (typeof window === 'undefined') {
    return `?topic=${encodeURIComponent(category)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('topic', category);
  return `${url.pathname}${url.search}`;
}

/**
 * Builds the full shareable URL for a topic.
 */
export function getTopicShareUrl(category: NewsCategory): string {
  if (typeof window === 'undefined') {
    return `https://littlables.github.io/?topic=${encodeURIComponent(category)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('topic', category);
  return url.toString();
}

/**
 * Builds the relative href for an individual story page.
 */
export function getStoryHref(item: NewsItem, currentCategory: NewsCategory = 'all'): string {
  const effectiveCategory = item.category && isValidCategory(item.category)
    ? item.category
    : currentCategory;
  const slug = getStorySlug(item);

  if (typeof window === 'undefined') {
    return `?topic=${encodeURIComponent(effectiveCategory)}&story=${encodeURIComponent(slug)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('topic', effectiveCategory);
  url.searchParams.set('story', slug);
  return `${url.pathname}${url.search}`;
}

/**
 * Builds the full shareable URL for an individual story page.
 */
export function getStoryShareUrl(item: NewsItem, currentCategory: NewsCategory = 'all'): string {
  const effectiveCategory = item.category && isValidCategory(item.category)
    ? item.category
    : currentCategory;
  const slug = getStorySlug(item);

  if (typeof window === 'undefined') {
    return `https://littlables.github.io/?topic=${encodeURIComponent(effectiveCategory)}&story=${encodeURIComponent(slug)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('topic', effectiveCategory);
  url.searchParams.set('story', slug);
  return url.toString();
}

/**
 * Parses the initial or current topic from the browser URL (query, hash, or path).
 */
export function parseTopicFromUrl(): NewsCategory | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const topicParam = url.searchParams.get('topic') || url.searchParams.get('category');
    if (isValidCategory(topicParam)) {
      return topicParam.toLowerCase() as NewsCategory;
    }

    // Check hash e.g. #childcare or #/topic/childcare
    const rawHash = url.hash.replace(/^#\/?/, '');
    if (rawHash) {
      const hashParts = rawHash.split('/').filter(Boolean);
      if (hashParts[0] === 'topic' && isValidCategory(hashParts[1])) {
        return hashParts[1].toLowerCase() as NewsCategory;
      }
      if (isValidCategory(hashParts[0])) {
        return hashParts[0].toLowerCase() as NewsCategory;
      }
    }

    // Check pathname e.g. /topic/childcare or /childcare
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      const prevPart = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
      if (prevPart === 'topic' && isValidCategory(lastPart)) {
        return lastPart.toLowerCase() as NewsCategory;
      }
      if (isValidCategory(lastPart)) {
        return lastPart.toLowerCase() as NewsCategory;
      }
    }
  } catch {}
  return null;
}

/**
 * Parses the story slug/ID from the browser URL.
 */
export function parseStoryFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const storyParam = url.searchParams.get('story');
    if (storyParam && storyParam.trim()) {
      return storyParam.trim();
    }

    const rawHash = url.hash.replace(/^#\/?/, '');
    if (rawHash.startsWith('story/')) {
      return decodeURIComponent(rawHash.slice('story/'.length)).trim() || null;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    const storyIdx = pathParts.indexOf('story');
    if (storyIdx !== -1 && pathParts[storyIdx + 1]) {
      return decodeURIComponent(pathParts[storyIdx + 1]).trim() || null;
    }
  } catch {}
  return null;
}

/**
 * Copies a URL to the user's clipboard with fallback support for iframes.
 */
export async function copyUrlToClipboard(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
