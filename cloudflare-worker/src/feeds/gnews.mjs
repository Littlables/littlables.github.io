import { normalizeArticle, requestFeed } from '../feed-utils.mjs';

export async function fetchGNews(config, category, market, options) {
  const categoryConfig = config.categories[category] || config.categories.all;
  const url = new URL(`${config.endpoint}/${categoryConfig.endpoint}`);
  if (categoryConfig.query) url.searchParams.set('q', categoryConfig.query);
  if (categoryConfig.category) url.searchParams.set('category', categoryConfig.category);
  url.searchParams.set('max', '10');
  const [language, country] = (market || '').split('-');
  if (/^[a-z]{2,3}$/i.test(language || '')) url.searchParams.set('lang', language.toLowerCase());
  if (/^[a-z]{2}$/i.test(country || '')) url.searchParams.set('country', country.toLowerCase());

  const body = await requestFeed(config.label, url, {
    ...options,
    headers: { Accept: 'application/json', 'X-Api-Key': options.credentials.GNEWS_API_KEY }
  });
  if (!Array.isArray(body?.articles)) throw new Error('GNews returned an invalid article response');
  const items = body.articles.map(article => normalizeArticle({
    title: article?.title,
    link: article?.url,
    image: article?.image,
    description: article?.description,
    content: article?.content,
    pubDate: article?.publishedAt,
    source: article?.source?.name
  })).filter(Boolean);
  if (!items.length) throw new Error('GNews returned no usable stories');
  return items;
}
