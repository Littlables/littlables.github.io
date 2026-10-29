import { NEWS_CONFIG } from '../constants/config';
import type { NewsItem } from '../types';
import type { Playroom } from './playroomService';
import type { Space } from './spaceService';

export interface PlayroomFeedResponse {
  playroom: Playroom | null;
  spaces: Space[];
  items: NewsItem[];
  count: number;
  error?: string;
}

export interface InterestFeedResponse {
  items: NewsItem[];
  count: number;
  error?: string;
}

const workerUrl = NEWS_CONFIG.workerUrl.replace(/\/$/, '');

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const playroomFeedCache = new Map<string, CacheEntry<PlayroomFeedResponse>>();
const inFlightPlayroomRequests = new Map<string, Promise<PlayroomFeedResponse>>();

const interestFeedCache = new Map<string, CacheEntry<InterestFeedResponse>>();
const inFlightInterestRequests = new Map<string, Promise<InterestFeedResponse>>();

function getPlayroomCacheKey(
  playroomId: string | null,
  spaceId?: string | null,
  username?: string,
  slug?: string
): string {
  return `${playroomId || ''}|${spaceId || 'all'}|${username || ''}|${slug || ''}`;
}

/**
 * Synchronously returns cached playroom feed if available in memory.
 */
export function getCachedPlayroomFeed(
  playroomId: string | null,
  spaceId?: string | null,
  username?: string,
  slug?: string
): PlayroomFeedResponse | null {
  const key = getPlayroomCacheKey(playroomId, spaceId, username, slug);
  const entry = playroomFeedCache.get(key);
  if (!entry) return null;
  return entry.data;
}

/**
 * Filters a playroom's combined stories locally for a specific space's pills
 * so switching spaces within a playroom can render immediately even before the space's
 * dedicated feed resolves.
 */
export function filterStoriesForSpace(allItems: NewsItem[], space: Space): NewsItem[] {
  const pills = Array.isArray(space.pills) ? space.pills : [];
  if (pills.length === 0) return allItems;

  const interestIds = new Set<string>();
  const customTerms: string[] = [];

  for (const pill of pills) {
    if (pill.id) {
      const cleanedId = String(pill.id).replace(/^custom[_:]/i, '').toLowerCase();
      if (cleanedId) interestIds.add(cleanedId);
    }
    if (pill.label) {
      customTerms.push(pill.label.toLowerCase());
    }
    if (pill.keywords) {
      for (const kw of pill.keywords.split(',')) {
        const trimmed = kw.trim().toLowerCase();
        if (trimmed) customTerms.push(trimmed);
      }
    }
  }

  return allItems.filter((story) => {
    if (story.category && interestIds.has(story.category.toLowerCase())) {
      return true;
    }
    if (Array.isArray(story.interestKeywords)) {
      for (const kw of story.interestKeywords) {
        if (interestIds.has(String(kw).toLowerCase())) return true;
      }
    }
    const text = `${story.title || ''} ${story.description || ''}`.toLowerCase();
    for (const id of interestIds) {
      if (id.length > 2 && text.includes(id.replace(/-/g, ' '))) {
        return true;
      }
    }
    for (const term of customTerms) {
      if (term.length > 2 && text.includes(term)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Prefetches each space's feed inside a playroom in the background so clicking
 * any space filter pill is instantaneous.
 */
export function prefetchPlayroomSpaces(playroomId: string, spaces: Space[]): void {
  if (!playroomId || !spaces.length) return;
  const run = () => {
    for (const space of spaces) {
      const key = getPlayroomCacheKey(playroomId, space.id);
      if (!playroomFeedCache.has(key) && !inFlightPlayroomRequests.has(key)) {
        fetchPlayroomFeed(playroomId, space.id).catch(() => {});
      }
    }
  };
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 150);
  }
}

export async function fetchPlayroomFeed(
  playroomId: string | null,
  spaceId?: string | null,
  username?: string,
  slug?: string,
  options?: { forceRefresh?: boolean }
): Promise<PlayroomFeedResponse> {
  const key = getPlayroomCacheKey(playroomId, spaceId, username, slug);
  if (!options?.forceRefresh) {
    const cached = playroomFeedCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const existing = inFlightPlayroomRequests.get(key);
  if (existing) return existing;

  const request = (async (): Promise<PlayroomFeedResponse> => {
    const url = new URL(`${workerUrl}/api/playroom`);
    if (playroomId) url.searchParams.set('id', playroomId);
    if (username) url.searchParams.set('username', username);
    if (slug) url.searchParams.set('slug', slug);
    if (spaceId) url.searchParams.set('space', spaceId);
    const res = await fetch(url.href);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Playroom feed request failed (HTTP ${res.status})`);
    }
    const result: PlayroomFeedResponse = {
      playroom: data.playroom || null,
      spaces: Array.isArray(data.spaces) ? data.spaces : [],
      items: Array.isArray(data.items) ? data.items : [],
      count: data.count || 0,
      error: data.error,
    };
    playroomFeedCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  })();

  inFlightPlayroomRequests.set(key, request);
  try {
    return await request;
  } finally {
    inFlightPlayroomRequests.delete(key);
  }
}

export function getCachedInterestFeed(interestIds: string[]): InterestFeedResponse | null {
  const ids = [...new Set(interestIds.map(String).filter(Boolean))].slice(0, 30);
  if (ids.length === 0) return { items: [], count: 0 };
  const key = ids.join(',');
  const entry = interestFeedCache.get(key);
  return entry ? entry.data : null;
}

export async function fetchInterestFeed(
  interestIds: string[],
  options?: { forceRefresh?: boolean }
): Promise<InterestFeedResponse> {
  const ids = [...new Set(interestIds.map(String).filter(Boolean))].slice(0, 30);
  if (ids.length === 0) return { items: [], count: 0 };
  const key = ids.join(',');

  if (!options?.forceRefresh) {
    const cached = interestFeedCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const existing = inFlightInterestRequests.get(key);
  if (existing) return existing;

  const request = (async (): Promise<InterestFeedResponse> => {
    const url = new URL(`${workerUrl}/api/interest`);
    url.searchParams.set('ids', key);
    const res = await fetch(url.href);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Interest feed request failed (HTTP ${res.status})`);
    }
    const result: InterestFeedResponse = {
      items: Array.isArray(data.items) ? data.items : [],
      count: data.count || 0,
      error: data.error,
    };
    interestFeedCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  })();

  inFlightInterestRequests.set(key, request);
  try {
    return await request;
  } finally {
    inFlightInterestRequests.delete(key);
  }
}
