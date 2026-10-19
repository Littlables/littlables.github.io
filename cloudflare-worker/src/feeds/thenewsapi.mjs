import { normalizeArticle, requestFeed } from '../feed-utils.mjs';

export async function fetchTheNewsApi(config, category, market, options) {
  const url = new URL(config.endpoint);
  url.searchParams.set('api_token', options.credentials.THENEWSAPI_API_KEY);
  const search = config.categories[category] || config.categories.all;
  if (category !== 'all' && search) {
    url.searchParams.set('search', search.replace(/\s+OR\s+/gi, ' | '));
  }
  url.searchParams.set('language', (market || 'en-US').split('-')[0].toLowerCase());
  url.searchParams.set('limit', '10');

  const body = await requestFeed(config.label, url, {
    ...options,
    headers: { Accept: 'application/json' }
  });
  if (!Array.isArray(body?.data)) throw new Error('TheNewsAPI.com returned an invalid article response');
  const items = body.data.map(article => normalizeArticle({
    title: article?.title,
    link: article?.url,
    image: article?.image_url,
    description: article?.description,
    content: article?.snippet,
    pubDate: article?.published_at,
    source: article?.source
  })).filter(Boolean);
  if (!items.length) throw new Error('TheNewsAPI.com returned no usable stories');
  return items;
}
