import {
  normalizeArticle,
  readXmlAttribute,
  readXmlTag,
  requestFeed,
  stripMarkup
} from '../feed-utils.mjs';

function parseRedditFeed(xml) {
  if (!/<feed\b/i.test(xml)) throw new Error('Reddit did not return an Atom feed');
  const items = [];
  for (const match of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry\s*>/gi)) {
    const entry = match[1];
    const title = readXmlTag(entry, 'title');
    const content = readXmlTag(entry, 'content');
    const embeddedImage = content.match(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const image = readXmlAttribute(entry, 'media:thumbnail', 'url') ||
      embeddedImage?.[1] ||
      embeddedImage?.[2] ||
      '';
    const link = readXmlAttribute(entry, 'link', 'href') || readXmlTag(entry, 'link');
    const subreddit = link.match(/\/r\/([^/]+)\//i)?.[1] || 'Reddit';
    const item = normalizeArticle({
      title,
      link,
      image,
      description: stripMarkup(content),
      pubDate: readXmlTag(entry, 'published') || readXmlTag(entry, 'updated'),
      source: `r/${subreddit}`
    });
    if (item) items.push(item);
  }
  if (!items.length) throw new Error('Reddit returned no usable posts');
  return items;
}

export async function fetchReddit(config, category, market, options) {
  const subreddits = config.categories[category] || config.categories.all;
  const url = new URL(`https://www.reddit.com/r/${subreddits.join('+')}/.rss`);
  url.searchParams.set('limit', '10');
  url.searchParams.set('sort', 'new');

  const xml = await requestFeed(config.label, url, {
    ...options,
    responseType: 'text',
    headers: {
      Accept: 'application/atom+xml,application/xml,text/xml',
      'User-Agent': 'Mozilla/5.0 (compatible; LittlablesFeed/1.0; +https://littlables.github.io/)'
    }
  });
  return parseRedditFeed(xml);
}
