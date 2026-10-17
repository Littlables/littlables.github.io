import assert from 'node:assert/strict';
import test from 'node:test';
import { getNewsFeed } from './news-feeds.mjs';

const article = {
  title: 'A family story & update',
  description: 'A short article description.',
  content: 'More article content [Read more...]',
  url: 'https://publisher.example/family',
  image: 'https://images.example/family.jpg',
  publishedAt: '2026-10-17T12:00:00Z',
  source: { name: 'Example News' }
};

test('GNews general category requests top headlines and normalizes article fields', async () => {
  let requestUrl;
  let requestOptions;
  const feed = await getNewsFeed('gnews', 'all', 'en-US', {
    apiKey: 'test-key',
    fetcher: async (url, options) => {
      requestUrl = new URL(url);
      requestOptions = options;
      return Response.json({ articles: [article] });
    }
  });

  assert.equal(requestUrl.pathname, '/api/v4/top-headlines');
  assert.equal(requestUrl.searchParams.get('category'), 'general');
  assert.equal(requestUrl.searchParams.get('lang'), 'en');
  assert.equal(requestUrl.searchParams.get('country'), 'us');
  assert.equal(requestUrl.searchParams.get('max'), '10');
  assert.equal(requestUrl.searchParams.has('apikey'), false);
  assert.equal(requestOptions.headers['X-Api-Key'], 'test-key');
  assert.deepEqual(feed.items[0], {
    title: article.title,
    link: article.url,
    image: article.image,
    description: 'A short article description.',
    content: 'More article content [Read more...]',
    pubDate: article.publishedAt,
    source: 'Example News'
  });
});

test('each topic uses its configured GNews query or headlines category', async () => {
  const expected = {
    childcare: ['search', 'childcare OR parenting OR family'],
    animals: ['search', 'animals OR wildlife OR conservation'],
    arts: ['search', 'arts OR culture OR creative'],
    tech: ['search', 'artificial intelligence OR technology'],
    world: ['top-headlines', null],
    uplifting: ['search', '"good news" OR positive news']
  };

  for (const [category, [endpoint, query]] of Object.entries(expected)) {
    let requestUrl;
    await getNewsFeed('gnews', category, 'en-US', {
      apiKey: 'test-key',
      fetcher: async url => {
        requestUrl = new URL(url);
        return Response.json({ articles: [article] });
      }
    });
    assert.equal(requestUrl.pathname, `/api/v4/${endpoint}`);
    if (query) assert.equal(requestUrl.searchParams.get('q'), query);
    else assert.equal(requestUrl.searchParams.get('category'), 'world');
  }
});

test('GNews requires an API key before making a request', async () => {
  let called = false;
  await assert.rejects(
    getNewsFeed('gnews', 'all', 'en-US', {
      fetcher: async () => {
        called = true;
        return Response.json({ articles: [article] });
      }
    }),
    /GNews API key is not configured/
  );
  assert.equal(called, false);
});

test('GNews quota responses retain their 429 status for the Worker and client', async () => {
  await assert.rejects(
    getNewsFeed('gnews', 'all', 'en-US', {
      apiKey: 'test-key',
      fetcher: async () => new Response('quota reached', { status: 429 })
    }),
    error => error.status === 429 && /quota or rate limit reached/.test(error.message)
  );
});

test('Bing remains available as a configured provider', async () => {
  const rss = `<rss><channel><item><title>Story</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fpublisher.example%2Fstory</link><description>Summary</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;
  const feed = await getNewsFeed('bing', 'animals', 'en-US', {
    fetcher: async () => new Response(rss)
  });
  assert.equal(feed.provider, 'bing');
  assert.equal(feed.items[0].link, 'https://publisher.example/story');
});
