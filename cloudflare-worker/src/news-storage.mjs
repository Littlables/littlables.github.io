const STORIES_TABLE = 'news_stories';
const SYNC_TABLE = 'news_provider_sync';

function supabaseHeaders(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function supabaseUrl(env, table, query = '') {
  const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;
  return query ? `${base}?${query}` : base;
}

async function readRows(response, context) {
  if (!response.ok) throw new Error(`${context} failed (HTTP ${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`${context} returned an invalid response`);
  return rows;
}

function normalizeStory(row) {
  return {
    title: row.title,
    link: row.article_url,
    image: row.image_url || '',
    description: row.description || '',
    content: row.content || '',
    pubDate: row.published_at || '',
    source: row.source_name || '',
    provider: row.provider,
    category: row.category
  };
}

export async function getStoredNewsFeed(env, category) {
  const query = new URLSearchParams({
    select: 'provider,category,title,article_url,image_url,description,content,published_at,source_name',
    category: `eq.${category}`,
    approved: 'eq.true',
    order: 'published_at.desc.nullslast,fetched_at.desc',
    limit: '50'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    headers: supabaseHeaders(env)
  });
  const rows = await readRows(response, 'Stored news feed lookup');
  const seenUrls = new Set();
  const items = [];
  for (const row of rows) {
    if (seenUrls.has(row.article_url)) continue;
    seenUrls.add(row.article_url);
    items.push(normalizeStory(row));
  }
  return { provider: 'supabase', items };
}

export async function getNewsAdminSnapshot(env, providers) {
  const storyCountQuery = new URLSearchParams({ select: 'id' });
  const recentQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,published_at,source_name,approved',
    order: 'fetched_at.desc',
    limit: '50'
  });
  const pendingQuery = new URLSearchParams({
    select: 'id,provider,category,title,article_url,image_url,description,published_at,source_name,approved',
    approved: 'eq.false',
    order: 'fetched_at.desc',
    limit: '100'
  });
  const [countResponse, recentResponse, pendingResponse, syncResponse] = await Promise.all([
    fetch(supabaseUrl(env, STORIES_TABLE, storyCountQuery), {
      headers: supabaseHeaders(env, { Range: '0-0', Prefer: 'count=exact' })
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, recentQuery), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, STORIES_TABLE, pendingQuery), {
      headers: supabaseHeaders(env)
    }),
    fetch(supabaseUrl(env, SYNC_TABLE, 'select=provider,status,started_at,last_attempt_at,last_success_at,stories_saved,last_error,updated_by'), {
      headers: supabaseHeaders(env)
    })
  ]);
  if (!countResponse.ok) throw new Error(`Story count lookup failed (HTTP ${countResponse.status})`);
  const contentRange = countResponse.headers.get('Content-Range') || '';
  const total = Number(contentRange.match(/\/(\d+|\*)$/)?.[1]);
  if (!Number.isFinite(total)) throw new Error('Story count lookup returned no exact count');
  const recentRows = await readRows(recentResponse, 'Recent story lookup');
  const pendingRows = await readRows(pendingResponse, 'Unapproved story lookup');
  const syncRows = await readRows(syncResponse, 'Provider status lookup');
  const syncByProvider = new Map(syncRows.map(row => [row.provider, row]));
  const seenUrls = new Set();
  const recentStories = [];
  for (const row of recentRows) {
    if (seenUrls.has(row.article_url)) continue;
    seenUrls.add(row.article_url);
    recentStories.push(normalizeStory(row));
    if (recentStories.length === 10) break;
  }
  return {
    totalStories: total,
    recentStories,
    pendingStories: pendingRows.map(row => ({
      ...normalizeStory(row),
      id: row.id,
      approved: row.approved
    })),
    providers: providers.map(provider => ({
      ...provider,
      ...(syncByProvider.get(provider.id) || {
        status: 'never',
        started_at: null,
        last_attempt_at: null,
        last_success_at: null,
        stories_saved: 0,
        last_error: null,
        updated_by: null
      })
    }))
  };
}

export async function approveNewsStory(env, storyId, approvedBy) {
  const query = new URLSearchParams({
    id: `eq.${storyId}`,
    approved: 'eq.false',
    select: 'id'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify({
      approved: true,
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    })
  });
  const rows = await readRows(response, 'Story approval update');
  if (rows.length !== 1) return false;
  return true;
}

export async function claimNewsProviderSync(env, provider, updatedBy) {
  const response = await fetch(supabaseUrl(env, 'rpc/claim_news_provider_sync'), {
    method: 'POST',
    headers: supabaseHeaders(env),
    body: JSON.stringify({ p_provider: provider, p_updated_by: updatedBy })
  });
  if (!response.ok) throw new Error(`Could not claim provider update (HTTP ${response.status})`);
  const result = await response.json();
  if (typeof result !== 'boolean') throw new Error('Provider update lock returned an invalid response');
  return result;
}

export async function upsertNewsStories(env, provider, category, stories) {
  if (!stories.length) return;
  const rows = stories.map(story => ({
    provider,
    category,
    title: story.title,
    article_url: story.link,
    image_url: story.image || null,
    description: story.description || null,
    content: story.content || null,
    published_at: story.pubDate || null,
    source_name: story.source || null,
    fetched_at: new Date().toISOString()
  }));
  const query = new URLSearchParams({
    on_conflict: 'provider,category,article_url'
  });
  const response = await fetch(supabaseUrl(env, STORIES_TABLE, query), {
    method: 'POST',
    headers: supabaseHeaders(env, {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`Saving ${provider}/${category} stories failed (HTTP ${response.status})`);
}

export async function finishNewsProviderSync(env, provider, {
  status,
  storiesSaved,
  error = null
}) {
  const query = new URLSearchParams({ provider: `eq.${provider}` });
  const response = await fetch(supabaseUrl(env, SYNC_TABLE, query), {
    method: 'PATCH',
    headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({
      status,
      started_at: null,
      last_success_at: status === 'succeeded' || status === 'partial' ? new Date().toISOString() : undefined,
      stories_saved: storiesSaved,
      last_error: error,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Saving ${provider} update status failed (HTTP ${response.status})`);
}
