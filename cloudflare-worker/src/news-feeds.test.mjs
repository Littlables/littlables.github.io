import assert from 'node:assert/strict';
import test from 'node:test';
import { getNewsFeed, getNewsProviders } from './news-feeds.mjs';

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
    credentials: { GNEWS_API_KEY: 'test-key' },
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
      credentials: { GNEWS_API_KEY: 'test-key' },
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

test('each API provider validates its own secret before making a request', async () => {
  const providers = [
    ['newsdata', 'NEWSDATA_API_KEY'],
    ['thenewsapi', 'THENEWSAPI_API_KEY'],
    ['worldnewsapi', 'WORLDNEWSAPI_API_KEY']
  ];
  for (const [provider, credential] of providers) {
    let called = false;
    await assert.rejects(
      getNewsFeed(provider, 'all', 'en-US', {
        fetcher: async () => {
          called = true;
          return Response.json({});
        }
      }),
      new RegExp(credential)
    );
    assert.equal(called, false);
  }
});

test('GNews quota responses retain their 429 status for the Worker and client', async () => {
  await assert.rejects(
    getNewsFeed('gnews', 'all', 'en-US', {
      credentials: { GNEWS_API_KEY: 'test-key' },
      retryDelays: [0, 0],
      fetcher: async () => new Response('quota reached', { status: 429 })
    }),
    error => error.status === 429 && /quota or rate limit reached/.test(error.message)
  );
});

test('transient network failures are retried with bounded backoff', async () => {
  let attempts = 0;
  const feed = await getNewsFeed('gnews', 'all', 'en-US', {
    credentials: { GNEWS_API_KEY: 'test-key' },
    retryDelays: [0, 0],
    fetcher: async () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary network failure');
      return Response.json({ articles: [article] });
    }
  });
  assert.equal(attempts, 3);
  assert.equal(feed.items.length, 1);
});

test('Bing remains available as a configured provider', async () => {
  const rss = `<rss><channel><item><title>Story</title><link>https://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fpublisher.example%2Fstory</link><description>Summary</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;
  const feed = await getNewsFeed('bing', 'animals', 'en-US', {
    fetcher: async () => new Response(rss)
  });
  assert.equal(feed.provider, 'bing');
  assert.equal(feed.items[0].link, 'https://publisher.example/story');
});

test('NewsData.io builds a topic query and normalizes its response shape', async () => {
  let requestUrl;
  const feed = await getNewsFeed('newsdata', 'animals', 'en-US', {
    credentials: { NEWSDATA_API_KEY: 'test-newsdata' },
    retryDelays: [0, 0],
    fetcher: async url => {
      requestUrl = new URL(url);
      return Response.json({ results: [{
        title: 'Wildlife update',
        link: 'https://publisher.example/wildlife',
        image_url: 'https://images.example/wildlife.jpg',
        description: 'A wildlife report.',
        content: 'Full report',
        pubDate: article.publishedAt,
        source_name: 'Wildlife News'
      }] });
    }
  });
  assert.equal(requestUrl.pathname, '/api/1/latest');
  assert.equal(requestUrl.searchParams.get('apikey'), 'test-newsdata');
  assert.equal(requestUrl.searchParams.get('language'), 'en');
  assert.equal(requestUrl.searchParams.get('size'), '10');
  assert.match(requestUrl.searchParams.get('q'), /wildlife/i);
  assert.equal(feed.items[0].source, 'Wildlife News');
  assert.equal(feed.items[0].pubDate, article.publishedAt);
});

test('TheNewsAPI.com queries topic news and normalizes its response shape', async () => {
  let requestUrl;
  const feed = await getNewsFeed('thenewsapi', 'tech', 'en-US', {
    credentials: { THENEWSAPI_API_KEY: 'test-thenews' },
    retryDelays: [0, 0],
    fetcher: async url => {
      requestUrl = new URL(url);
      return Response.json({ data: [{
        title: 'Technology update',
        url: 'https://publisher.example/technology',
        image_url: 'https://images.example/technology.jpg',
        description: 'A technology report.',
        snippet: 'Article snippet',
        published_at: article.publishedAt,
        source: 'Technology News'
      }] });
    }
  });
  assert.equal(requestUrl.pathname, '/v1/news/all');
  assert.equal(requestUrl.searchParams.get('api_token'), 'test-thenews');
  assert.equal(requestUrl.searchParams.get('language'), 'en');
  assert.equal(requestUrl.searchParams.get('limit'), '10');
  assert.match(requestUrl.searchParams.get('search'), /artificial intelligence/i);
  assert.equal(feed.items[0].source, 'Technology News');
});

test('WorldNewsAPI uses the key header and normalizes search results', async () => {
  let requestUrl;
  let requestOptions;
  const feed = await getNewsFeed('worldnewsapi', 'world', 'en-US', {
    credentials: { WORLDNEWSAPI_API_KEY: 'test-worldnews' },
    retryDelays: [0, 0],
    fetcher: async (url, options) => {
      requestUrl = new URL(url);
      requestOptions = options;
      return Response.json({ news: [{
        title: 'World report',
        url: 'https://publisher.example/world',
        image: 'https://images.example/world.jpg',
        text: 'Full report text.',
        summary: 'A world report.',
        publish_date: article.publishedAt,
        source: 'World News'
      }] });
    }
  });
  assert.equal(requestUrl.pathname, '/search-news');
  assert.equal(requestUrl.searchParams.get('language'), 'en');
  assert.equal(requestUrl.searchParams.get('number'), '10');
  assert.equal(requestUrl.searchParams.get('sort'), 'publish-time');
  assert.equal(requestUrl.searchParams.get('sort-direction'), 'desc');
  assert.equal(requestOptions.headers['x-api-key'], 'test-worldnews');
  assert.equal(feed.items[0].description, 'A world report.');
});

test('Reddit combines configured subreddits into an RSS feed', async () => {
  let requestUrl;
  const rss = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><entry><title>Helpful parenting story</title><published>${article.publishedAt}</published><link href="https://www.reddit.com/r/Parenting/comments/abc/helpful/" /><media:thumbnail url="https://images.example/parenting.jpg" /><content type="html">&lt;p&gt;A helpful community post.&lt;/p&gt;</content></entry></feed>`;
  const feed = await getNewsFeed('reddit', 'childcare', 'en-US', {
    retryDelays: [0, 0],
    fetcher: async (url, options) => {
      requestUrl = new URL(url);
      assert.match(options.headers['User-Agent'], /LittlablesFeed/);
      return new Response(rss);
    }
  });
  assert.equal(requestUrl.hostname, 'www.reddit.com');
  assert.equal(requestUrl.pathname, '/r/Parenting+ScienceBasedParenting/.rss');
  assert.equal(requestUrl.searchParams.get('limit'), '10');
  assert.deepEqual(feed.items[0], {
    title: 'Helpful parenting story',
    link: 'https://www.reddit.com/r/Parenting/comments/abc/helpful/',
    image: 'https://images.example/parenting.jpg',
    description: 'A helpful community post.',
    content: '',
    pubDate: article.publishedAt,
    source: 'r/Parenting'
  });
});

test('provider catalog reports configured credentials for all integrations', () => {
  const providers = getNewsProviders({
    GNEWS_API_KEY: 'gnews',
    NEWSDATA_API_KEY: 'newsdata',
    THENEWSAPI_API_KEY: 'thenews',
    WORLDNEWSAPI_API_KEY: ''
  });
  assert.deepEqual(providers.map(provider => provider.id), [
    'gnews', 'bing', 'newsdata', 'thenewsapi', 'worldnewsapi', 'reddit'
  ]);
  assert.equal(providers.find(provider => provider.id === 'worldnewsapi').configured, false);
  assert.equal(providers.find(provider => provider.id === 'reddit').configured, true);
  assert.equal(providers.find(provider => provider.id === 'reddit').update_pause_ms, 6000);
});

test('GNews rate limit error extracts Retry-After, quota headers, error detail, and redacts API keys in fetch logs', async () => {
  const loggedEntries = [];
  await assert.rejects(
    getNewsFeed('newsdata', 'tech', 'en-US', {
      credentials: { NEWSDATA_API_KEY: 'super-secret-newsdata-key' },
      retryDelays: [0, 0],
      onFetchLog: entry => { loggedEntries.push(entry); },
      fetcher: async () => new Response(
        JSON.stringify({ status: 'error', results: { message: 'Daily API request quota exceeded for this plan.' } }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '1800',
            'X-RateLimit-Remaining': '0'
          }
        }
      )
    }),
    error => {
      assert.equal(error.status, 429);
      assert.equal(error.isRateLimit, true);
      assert.equal(error.retryAfterSeconds, 1800);
      assert.equal(error.rateLimitRemaining, '0');
      assert.match(error.message, /quota or rate limit reached/);
      assert.match(error.message, /retry_after=1800s/);
      assert.match(error.message, /Daily API request quota exceeded/);
      return true;
    }
  );
  assert.equal(loggedEntries.length, 1);
  assert.equal(loggedEntries[0].status, 'rate_limited');
  assert.equal(loggedEntries[0].httpStatus, 429);
  assert.equal(loggedEntries[0].retryAfterSeconds, 1800);
  assert.equal(loggedEntries[0].rateLimitRemaining, '0');
  assert.doesNotMatch(loggedEntries[0].requestUrl, /super-secret-newsdata-key/);
  assert.match(loggedEntries[0].requestUrl, /apikey=%5BREDACTED%5D/);
});

