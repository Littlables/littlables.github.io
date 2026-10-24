import { NEWS_CONFIG } from '../constants/config';
import type { NewsItem } from '../types';
import type { Playroom } from './playroomService';
import type { Board } from './boardService';

export interface PlayroomFeedResponse {
  playroom: Playroom | null;
  spaces: Board[];
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

export async function fetchPlayroomFeed(
  playroomId: string | null,
  spaceId?: string | null,
  username?: string,
  slug?: string
): Promise<PlayroomFeedResponse> {
  const url = new URL(`${workerUrl}/api/playroom`);
  if (playroomId) url.searchParams.set('id', playroomId);
  if (username) url.searchParams.set('username', username);
  if (slug) url.searchParams.set('slug', slug);
  if (spaceId) url.searchParams.set('space', spaceId);
  const res = await fetch(url.href, { cache: 'no-cache' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Playroom feed request failed (HTTP ${res.status})`);
  }
  return {
    playroom: data.playroom || null,
    spaces: Array.isArray(data.spaces) ? data.spaces : [],
    items: Array.isArray(data.items) ? data.items : [],
    count: data.count || 0,
    error: data.error,
  };
}

export async function fetchInterestFeed(interestIds: string[]): Promise<InterestFeedResponse> {
  const ids = [...new Set(interestIds.map(String).filter(Boolean))].slice(0, 30);
  if (ids.length === 0) return { items: [], count: 0 };
  const url = new URL(`${workerUrl}/api/interest`);
  url.searchParams.set('ids', ids.join(','));
  const res = await fetch(url.href, { cache: 'no-cache' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Interest feed request failed (HTTP ${res.status})`);
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    count: data.count || 0,
    error: data.error,
  };
}
