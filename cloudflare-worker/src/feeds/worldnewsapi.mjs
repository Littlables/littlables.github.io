import { normalizeArticle, requestFeed } from '../feed-utils.mjs';

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export async function fetchWorldNewsApi(config, category, market, options) {
  const url = new URL(config.endpoint);
  url.searchParams.set('text', config.categories[category] || config.categories.all);
  url.searchParams.set('language', (market || 'en-US').split('-')[0].toLowerCase());
  url.searchParams.set('number', '10');
  url.searchParams.set('sort', 'publish-time');
  url.searchParams.set('sort-direction', 'desc');

  const body = await requestFeed(config.label, url, {
    ...options,
    headers: { Accept: 'application/json', 'x-api-key': options.credentials.WORLDNEWSAPI_API_KEY }
  });
  if (!Array.isArray(body?.news)) throw new Error('WorldNewsAPI returned an invalid article response');
  const items = body.news.map(article => normalizeArticle({
    title: article?.title,
    link: article?.url,
    image: article?.image,
    description: article?.summary || article?.text,
    content: article?.text,
    pubDate: article?.publish_date,
    source: article?.source_name || article?.source || hostname(article?.url)
  })).filter(Boolean);
  if (!items.length) throw new Error('WorldNewsAPI returned no usable stories');
  return items;
}
