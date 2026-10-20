import { NewsCategory, StandardNewsCategory, NewsItem } from '../types';
import { CATEGORIES } from '../constants/config';
import { getStoryId } from './supabaseService';
import { getDomainFromUrl } from './trackingService';

const VALID_CATEGORIES = new Set<StandardNewsCategory>(
  CATEGORIES.map(c => c.id as StandardNewsCategory)
);

const RESERVED_PATH_SEGMENTS = new Set([
  'index.html',
  'admin',
  'story',
  'feed',
  'ads',
  'img',
  'assets',
  'public',
  'api',
  'topic'
]);

export function isValidCategory(value: string | null | undefined): value is StandardNewsCategory {
  if (!value) return false;
  return VALID_CATEGORIES.has(value.trim().toLowerCase() as StandardNewsCategory);
}

export function isCustomTopic(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return Boolean(trimmed) && !isValidCategory(trimmed);
}

/**
 * Formats a custom topic keyword into a clean human-readable title.
 */
export function formatCustomTopicLabel(topic: string): string {
  const cleaned = String(topic || '')
    .trim()
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Custom Topic';
  return cleaned
    .split(' ')
    .map(word => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

/**
 * Builds stem variants for a single lowercase search token (e.g. puppy <-> puppies, otter <-> otters).
 */
export function getTokenVariants(token: string): string[] {
  const lower = token.toLowerCase().trim();
  if (!lower) return [];
  const variants = new Set<string>([lower]);

  if (lower.endsWith('ies') && lower.length > 4) {
    variants.add(`${lower.slice(0, -3)}y`);
  } else if (lower.endsWith('y') && lower.length > 3 && !/[aeiou]y$/.test(lower)) {
    variants.add(`${lower.slice(0, -1)}ies`);
  }

  if (lower.endsWith('es') && lower.length > 4) {
    variants.add(lower.slice(0, -2));
    variants.add(lower.slice(0, -1));
  } else if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    variants.add(lower.slice(0, -1));
  } else if (lower.length >= 3 && !lower.endsWith('s')) {
    variants.add(`${lower}s`);
  }

  return Array.from(variants);
}

/**
 * Extracts normalized search tokens from a topic keyword string.
 */
export function getKeywordTokens(keyword: string): string[] {
  const normalized = String(keyword || '')
    .toLowerCase()
    .replace(/[-_+]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  if (!normalized) return [];
  return Array.from(new Set(normalized.split(/\s+/).filter(Boolean)));
}

/**
 * Checks whether a block of text matches all tokens (or their singular/plural variants)
 * in the supplied keyword query.
 */
export function matchesKeywordQuery(searchableText: string, keyword: string): boolean {
  if (!searchableText || !keyword) return false;
  const haystack = searchableText.toLowerCase();
  const normalizedKeyword = keyword
    .toLowerCase()
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalizedKeyword) return false;

  if (haystack.includes(normalizedKeyword)) {
    return true;
  }

  const tokens = getKeywordTokens(normalizedKeyword);
  if (tokens.length === 0) return false;

  return tokens.every(token => {
    const variants = getTokenVariants(token);
    return variants.some(variant => haystack.includes(variant));
  });
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
 * Normalizes a topic identifier for URL query strings.
 */
function normalizeTopicParamValue(category: NewsCategory): string {
  const trimmed = String(category || 'all').trim();
  if (!trimmed) return 'all';
  return isValidCategory(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/**
 * Builds the relative href for a topic so links work on both root and subpaths.
 */
export function getTopicHref(category: NewsCategory): string {
  const topicValue = normalizeTopicParamValue(category);
  if (typeof window === 'undefined') {
    return `?topic=${encodeURIComponent(topicValue)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('topic', topicValue);
  return `${url.pathname}${url.search}`;
}

/**
 * Builds the full shareable URL for a topic.
 */
export function getTopicShareUrl(category: NewsCategory): string {
  const topicValue = normalizeTopicParamValue(category);
  if (typeof window === 'undefined') {
    return `https://littlables.github.io/?topic=${encodeURIComponent(topicValue)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('topic', topicValue);
  return url.toString();
}

/**
 * Builds the relative href for an individual story page.
 */
export function getStoryHref(item: NewsItem, currentCategory: NewsCategory = 'all'): string {
  const effectiveCategory = isCustomTopic(currentCategory)
    ? normalizeTopicParamValue(currentCategory)
    : (item.category && isValidCategory(item.category)
      ? item.category
      : normalizeTopicParamValue(currentCategory));
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
  const effectiveCategory = isCustomTopic(currentCategory)
    ? normalizeTopicParamValue(currentCategory)
    : (item.category && isValidCategory(item.category)
      ? item.category
      : normalizeTopicParamValue(currentCategory));
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
 * Supports both the 7 standard categories and any custom keyword topic.
 */
export function parseTopicFromUrl(): NewsCategory | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const topicParam =
      url.searchParams.get('topic') ||
      url.searchParams.get('category') ||
      url.searchParams.get('q') ||
      url.searchParams.get('search');

    if (topicParam && topicParam.trim()) {
      const cleaned = topicParam.trim();
      return isValidCategory(cleaned) ? cleaned.toLowerCase() : cleaned;
    }

    // Check hash e.g. #childcare, #puppy, or #/topic/puppy
    const rawHash = url.hash.replace(/^#\/?/, '');
    if (rawHash && !rawHash.startsWith('story/')) {
      const hashParts = rawHash.split('/').filter(Boolean);
      if (hashParts[0] === 'topic' && hashParts[1]) {
        const candidate = decodeURIComponent(hashParts.slice(1).join(' ')).trim();
        if (candidate) {
          return isValidCategory(candidate) ? candidate.toLowerCase() : candidate;
        }
      } else if (hashParts.length === 1) {
        const candidate = decodeURIComponent(hashParts[0]).trim();
        if (candidate) {
          return isValidCategory(candidate) ? candidate.toLowerCase() : candidate;
        }
      }
    }

    // Check pathname e.g. /topic/childcare, /topic/puppy, or /childcare
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      const prevPart = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
      if (prevPart === 'topic' && lastPart) {
        const candidate = decodeURIComponent(lastPart).trim();
        if (candidate) {
          return isValidCategory(candidate) ? candidate.toLowerCase() : candidate;
        }
      }
      if (
        lastPart &&
        !lastPart.includes('.') &&
        !RESERVED_PATH_SEGMENTS.has(lastPart.toLowerCase()) &&
        prevPart !== 'story'
      ) {
        const candidate = decodeURIComponent(lastPart).trim();
        if (candidate) {
          return isValidCategory(candidate) ? candidate.toLowerCase() : candidate;
        }
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
  const effectiveCategory = isCustomTopic(category) ? category : (item.category || category);
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
