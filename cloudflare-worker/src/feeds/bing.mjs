import { parseRss, requestFeed } from '../feed-utils.mjs';

export async function fetchBing(config, category, market, options) {
  const url = new URL(config.endpoint);
  url.searchParams.set('q', config.categories[category] || config.categories.all);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('freshness', 'Day');
  if (/^[a-z]{2}-[A-Z]{2}$/.test(market || '')) url.searchParams.set('mkt', market);

  const xml = await requestFeed(config.label, url, {
    ...options,
    responseType: 'text',
    headers: {
      Accept: 'application/rss+xml,application/xml,text/xml',
      'User-Agent': 'Mozilla/5.0 (compatible; LittlablesFeed/1.0)'
    }
  });
  const oldestAcceptedDate = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return parseRss(xml).filter(item => {
    const timestamp = Date.parse(item.pubDate);
    return !Number.isFinite(timestamp) || timestamp >= oldestAcceptedDate;
  });
}
