import { NewsCategory, NewsItem } from '../types';
import { CATEGORIES } from '../constants/config';
import { getStoryId } from './supabaseService';
import { getDomainFromUrl } from './trackingService';

const VALID_CATEGORIES = new Set<NewsCategory>(CATEGORIES.map(c => c.id));

export function isValidCategory(value: string | null | undefined): value is NewsCategory {
  if (!value) return false;
  return VALID_CATEGORIES.has(value.toLowerCase() as NewsCategory);
}

/**
 * Returns the displayable provider/source name for a story badge.
 */
export function getStoryProviderName(item: NewsItem): string {
  if (item.source && item.source.trim()) {
    return item.source.trim();
  }
  const domain = getDomainFromUrl(item.link);
  if (domain && domain !== 'unknown') {
    return domain.replace(/^www\./i, '');
  }
  if (item.provider && item.provider.trim()) {
    return item.provider.trim();
  }
  return '';
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
 * Resolves any relative or protocol-relative image URL into an absolute URL.
 */
export function toAbsoluteImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('data:image/')) return imageUrl;
  if (typeof window === 'undefined') {
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    return `https://littlables.github.io/${imageUrl.replace(/^\/+/, '')}`;
  }
  try {
    return new URL(imageUrl, window.location.href).href;
  } catch {
    return imageUrl;
  }
}

/**
 * Updates OpenGraph and Twitter meta tags in document.head so native share sheets
 * and link previewers pick up the active story's image, title, description, and URL.
 */
export function updateStoryOpenGraphTags(
  item: NewsItem | null,
  imageUrl?: string,
  shareUrl?: string
): void {
  if (typeof document === 'undefined') return;

  const setMeta = (selector: string, content: string) => {
    const el = document.querySelector<HTMLMetaElement>(selector);
    if (el && content) {
      el.setAttribute('content', content);
    }
  };

  if (!item) {
    const defaultTitle = 'Littlables — A Little Scoop of the World';
    const defaultDesc =
      'Littlables delivers curated, family-friendly news and AI summaries across childcare, animals, creative arts, future tech, and uplifting global stories.';
    const defaultImg = toAbsoluteImageUrl('img/all_1.jpg');
    const defaultUrl = typeof window !== 'undefined' ? window.location.href : 'https://littlables.github.io/';

    setMeta('meta[property="og:title"]', defaultTitle);
    setMeta('meta[name="twitter:title"]', defaultTitle);
    setMeta('meta[property="og:description"]', defaultDesc);
    setMeta('meta[name="twitter:description"]', defaultDesc);
    setMeta('meta[property="og:image"]', defaultImg);
    setMeta('meta[name="twitter:image"]', defaultImg);
    setMeta('meta[property="og:url"]', defaultUrl);
    return;
  }

  const title = `${item.title} — Littlables`;
  const desc = item.aiSummary || item.description || item.title;
  const absImg = toAbsoluteImageUrl(imageUrl || item.image || 'img/all_1.jpg');
  const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : 'https://littlables.github.io/');

  setMeta('meta[property="og:title"]', title);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[property="og:description"]', desc);
  setMeta('meta[name="twitter:description"]', desc);
  if (!absImg.startsWith('data:')) {
    setMeta('meta[property="og:image"]', absImg);
    setMeta('meta[name="twitter:image"]', absImg);
  }
  setMeta('meta[property="og:url"]', url);
}

/**
 * Attempts to fetch the story image and package it as a File for navigator.share({ files }).
 */
async function fetchImageAsShareFile(imageUrl: string, item: NewsItem): Promise<File | null> {
  if (typeof window === 'undefined' || typeof File === 'undefined') return null;
  const absUrl = toAbsoluteImageUrl(imageUrl);
  if (!absUrl) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1800);

  try {
    const response = await fetch(absUrl, {
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob || blob.size === 0) return null;

    const mimeType = (blob.type || 'image/jpeg').split(';')[0].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) return null;

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    const ext = extMap[mimeType] || 'jpg';
    const fileType = extMap[mimeType] ? mimeType : 'image/jpeg';
    const baseName = getStorySlug(item).slice(0, 40) || 'littlables-story';

    return new File([blob], `${baseName}.${ext}`, { type: fileType });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Copies a URL to the user's clipboard with rich HTML (including the story image when available)
 * and plain text URL fallback.
 */
export async function copyUrlToClipboard(
  url: string,
  item?: NewsItem,
  imageUrl?: string
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const absImg = imageUrl ? toAbsoluteImageUrl(imageUrl) : '';

  try {
    if (
      item &&
      absImg &&
      !absImg.startsWith('data:') &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const safeTitle = escapeHtml(item.title || 'Littlables Story');
      const safeUrl = escapeHtml(url);
      const safeImg = escapeHtml(absImg);
      const htmlContent = `<a href="${safeUrl}"><img src="${safeImg}" alt="${safeTitle}" style="max-width:480px;border-radius:12px;display:block;margin-bottom:8px;" /><strong>${safeTitle}</strong></a><br/><a href="${safeUrl}">${safeUrl}</a>`;

      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([url], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' })
      });
      await navigator.clipboard.write([clipboardItem]);
      return true;
    }
  } catch {}

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

/**
 * Shares a story via clipboard and native Web Share API, attaching the story image file when supported.
 */
export async function shareStoryWithImage(
  item: NewsItem,
  category: NewsCategory,
  resolvedImageUrl: string
): Promise<boolean> {
  const effectiveCategory = item.category || category;
  const shareUrl = getStoryShareUrl(item, effectiveCategory);

  updateStoryOpenGraphTags(item, resolvedImageUrl, shareUrl);

  const copied = await copyUrlToClipboard(shareUrl, item, resolvedImageUrl);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const shareText = item.aiSummary || item.description || item.title;
    try {
      const imageFile = await fetchImageAsShareFile(resolvedImageUrl, item);
      if (imageFile && typeof navigator.canShare === 'function') {
        const withFileAndUrl: ShareData = {
          title: item.title,
          text: shareText,
          url: shareUrl,
          files: [imageFile]
        };
        if (navigator.canShare(withFileAndUrl)) {
          await navigator.share(withFileAndUrl);
          return true;
        }
        const withFileOnly: ShareData = {
          title: item.title,
          text: `${shareText}\n${shareUrl}`,
          files: [imageFile]
        };
        if (navigator.canShare(withFileOnly)) {
          await navigator.share(withFileOnly);
          return true;
        }
      }

      if (window.matchMedia?.('(pointer: coarse)').matches) {
        await navigator.share({
          title: item.title,
          text: shareText,
          url: shareUrl
        });
        return true;
      }
    } catch {
      // User cancelled native share sheet or browser disallowed; clipboard copy already succeeded.
    }
  }

  return copied;
}
