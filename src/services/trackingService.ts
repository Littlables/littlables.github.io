import { NewsItem, AdItem, NewsCategory } from '../types';

declare global {
  interface Window {
    umami?: {
      track: (
        eventOrData?: string | { url?: string; title?: string; [key: string]: any },
        data?: Record<string, any>
      ) => void;
    };
  }
}

/**
 * Extracts a clean domain from a URL (e.g. "https://www.bbc.com/news/123" -> "bbc.com")
 */
export function getDomainFromUrl(url?: string): string {
  if (!url || url === '#') return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Identifies the ad network / sponsor origin for an ad URL
 */
export function getAdNetwork(url?: string, sponsor?: string): 'Amazon' | 'Gumroad' | 'TikTok' | 'Partner' {
  if (!url) return 'Partner';
  const lowerUrl = url.toLowerCase();
  const lowerSponsor = (sponsor || '').toLowerCase();

  if (lowerUrl.includes('amazon.com') || lowerSponsor.includes('amazon')) {
    return 'Amazon';
  }
  if (
    lowerUrl.includes('tiktok.com') ||
    lowerUrl.includes('partnerlinks.io') ||
    lowerSponsor.includes('tiktok')
  ) {
    return 'TikTok';
  }
  if (lowerUrl.includes('gumroad.com') || lowerSponsor.includes('gumroad')) {
    return 'Gumroad';
  }
  return 'Partner';
}

/**
 * Mapping of category IDs to Umami event names for ribbon clicks
 */
export const RIBBON_UMAMI_EVENTS: Record<NewsCategory, string> = {
  childcare: 'Ribbon-Childcare',
  all: 'Ribbon-TopCurrents',
  animals: 'Ribbon-Animals',
  arts: 'Ribbon-CreativeArts',
  tech: 'Ribbon-Tech',
  world: 'Ribbon-World',
  uplifting: 'Ribbon-Uplifting'
};

/**
 * Core Umami exit page tracking as requested:
 * umami.track({ url: '${URL}', title: '${TITLE}' });
 */
export function trackExitPage(url: string, title: string) {
  if (typeof window === 'undefined' || !url || url === '#') return;
  try {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track({ url, title });
    }
  } catch (err) {
    console.debug('Umami track failed:', err);
  }
}

/**
 * Tracks an ad card or link click
 */
export function trackAdClick(ad: AdItem) {
  if (!ad.url || ad.url === '#') return;
  const network = getAdNetwork(ad.url, ad.sponsor);
  const domain = getDomainFromUrl(ad.url) || network;
  const title = `${network} | ${domain} | ${ad.title}`;

  trackExitPage(ad.url, title);
}

/**
 * Tracks an outbound story link click
 */
export function trackStoryClick(item: NewsItem) {
  if (!item.link || item.link === '#') return;
  const domain = getDomainFromUrl(item.link);
  const title = domain ? `${domain} | ${item.title}` : item.title;

  trackExitPage(item.link, title);
}

/**
 * Tracks a category ribbon selection
 */
export function trackCategoryClick(category: NewsCategory) {
  const eventName = RIBBON_UMAMI_EVENTS[category] || `Ribbon-${category}`;
  if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
    try {
      window.umami.track(eventName, { category });
    } catch (err) {
      console.debug('Umami category track failed:', err);
    }
  }
}

export function trackHomeLogoRefresh() {
  if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
    try {
      window.umami.track('Home-Logo-Refresh');
    } catch (err) {
      console.debug('Umami home logo track failed:', err);
    }
  }
}

// ── Engagement tracking for recommendation engine ──
// Sends anonymous view/click events to the worker for CTR-based scoring.
// Fire-and-forget: never blocks UI, never throws.

const WORKER_URL = 'https://hello-ai.cryptokatiee.workers.dev';

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('littlables_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('littlables_sid', sid);
    }
    return sid;
  } catch {
    return '';
  }
}

function sendEngagementEvent(
  eventType: 'view' | 'click',
  item: NewsItem,
  category?: string
) {
  if (typeof window === 'undefined' || !item.link || item.link === '#') return;
  try {
    const payload = {
      url: item.link,
      title: item.title,
      category: category || item.category || 'all',
      eventType,
      sessionId: getSessionId(),
      // Story keywords at event time (for keyword CTR analytics)
      keywords: Array.isArray(item.interestKeywords) ? item.interestKeywords.slice(0, 10) : [],
      // Acquisition attribution (captured once per page load)
      ...getAttribution(),
    };
    // Use sendBeacon when available (survives page unload), fallback to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(`${WORKER_URL}/api/engagement`, blob);
    } else {
      fetch(`${WORKER_URL}/api/engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently ignore — tracking must never break the site
  }
}

// Capture once per page load: referrer domain (never full URL) + UTM params.
let attributionCache: {
  referrer_domain: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
} | null = null;

function getAttribution() {
  if (attributionCache) return attributionCache;
  let referrer_domain = '';
  let utm_source = '';
  let utm_medium = '';
  let utm_campaign = '';
  try {
    if (document.referrer) {
      try {
        referrer_domain = new URL(document.referrer).hostname.slice(0, 120);
      } catch {
        // ignore malformed referrer
      }
    }
    const params = new URLSearchParams(window.location.search);
    utm_source = (params.get('utm_source') || '').slice(0, 120);
    utm_medium = (params.get('utm_medium') || '').slice(0, 120);
    utm_campaign = (params.get('utm_campaign') || '').slice(0, 120);
  } catch {
    // ignore
  }
  attributionCache = { referrer_domain, utm_source, utm_medium, utm_campaign };
  return attributionCache;
}

/**
 * Record a story view (card became visible in viewport).
 * Callers should debounce/dedupe — this sends every time it's called.
 */
export function trackStoryView(item: NewsItem, category?: string) {
  sendEngagementEvent('view', item, category);
}

/**
 * Record a story click (user opened the story).
 * Call alongside the existing Umami tracking.
 */
export function trackStoryEngagementClick(item: NewsItem, category?: string) {
  sendEngagementEvent('click', item, category);
}

/**
 * Record dwell time on a story (seconds the preview was open).
 * Only sends if >= 2s; worker caps at 600s.
 */
export function trackStoryDwell(item: NewsItem, dwellSeconds: number, category?: string) {
  const secs = Math.round(dwellSeconds);
  if (secs < 2 || typeof window === 'undefined' || !item.link || item.link === '#') return;
  try {
    const payload = {
      url: item.link,
      title: item.title,
      category: category || item.category || 'all',
      eventType: 'dwell' as const,
      sessionId: getSessionId(),
      dwell_seconds: Math.min(600, secs),
      keywords: Array.isArray(item.interestKeywords) ? item.interestKeywords.slice(0, 10) : [],
      ...getAttribution(),
    };
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${WORKER_URL}/api/engagement`, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(`${WORKER_URL}/api/engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently ignore
  }
}

// ── Board creation analytics ──
// Logs which pills a new board uses. Anonymous: pills only, no user_id, no name.

interface BoardPill {
  id: string;
  type: 'category' | 'custom' | 'keyword';
}

/**
 * Record a board creation (pills only — never the board name or user).
 * Call after a successful board insert.
 */
export function trackBoardCreated(pills: BoardPill[]) {
  if (typeof window === 'undefined' || !Array.isArray(pills) || pills.length === 0) return;
  try {
    const keywordIds = pills.filter((p) => p.type === 'keyword').map((p) => p.id);
    const categoryIds = pills.filter((p) => p.type === 'category').map((p) => p.id);
    if (keywordIds.length === 0 && categoryIds.length === 0) return;
    const body = JSON.stringify({
      sessionId: getSessionId(),
      keywordIds: keywordIds.slice(0, 20),
      categoryIds: categoryIds.slice(0, 20),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${WORKER_URL}/api/analytics/board`, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(`${WORKER_URL}/api/analytics/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently ignore
  }
}
