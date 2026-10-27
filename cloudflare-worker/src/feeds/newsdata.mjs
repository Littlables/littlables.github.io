import { normalizeArticle, requestFeed } from '../feed-utils.mjs';

export async function fetchNewsData(config, category, market, options) {
  const url = new URL(config.endpoint);
  url.searchParams.set('apikey', options.credentials.NEWSDATA_API_KEY);
  const query = config.categories[category] || config.categories.all;
  if (category !== 'all' && query) url.searchParams.set('q', query);
  url.searchParams.set('language', (market || 'en-US').split('-')[0].toLowerCase());
  url.searchParams.set('size', '10');

  const body = await requestFeed(config.label, url, {
    ...options,
    headers: { Accept: 'application/json' }
  });
  if (!Array.isArray(body?.results)) throw new Error('NewsData.io returned an invalid article response');
  const items = body.results.map(article => normalizeArticle({
    title: article?.title,
    link: article?.link,
    image: article?.image_url,
    description: article?.description,
    content: article?.content,
    pubDate: article?.pubDate,
    source: article?.source_name || article?.source_id,
    providerCountry: Array.isArray(article?.country) ? article.country[0] : (article?.country || null)
  })).filter(Boolean);
  if (!items.length) throw new Error('NewsData.io returned no usable stories');
  return items;
}
