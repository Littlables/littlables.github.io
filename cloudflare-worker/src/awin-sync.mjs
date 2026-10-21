/**
 * Awin affiliate integration — syncs joined programs and product feeds
 * into Supabase. Triggered manually from the admin panel
 * (POST /admin/api/awin/sync); schedules can be added later.
 *
 * Auth: Bearer token from Awin UI (user menu → API Credentials),
 * stored as the AWIN_API_TOKEN worker secret. Never exposed client-side.
 */

const AWIN_API_BASE = 'https://api.awin.com';

// Best-effort sector → Littlables category mapping. The sync never overwrites
// a category that was set manually in the admin panel (category column).
const SECTOR_CATEGORY_HINTS = [
  [/sport|bike|cycl|outdoor|fitness/i, 'tech'],
  [/electronic|computer|gadget|mobile|tech/i, 'tech'],
  [/toy|child|kid|baby|family|parent/i, 'childcare'],
  [/pet|animal/i, 'animals'],
  [/art|craft|music|book|photo|design/i, 'arts'],
  [/travel|holiday|hotel|flight/i, 'world'],
  [/health|wellness|beauty|mindful/i, 'uplifting'],
];

function awinHeaders(env) {
  return {
    Authorization: `Bearer ${env.AWIN_API_TOKEN}`,
    Accept: 'application/json',
  };
}

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

function supabaseUrl(env, table, query = '') {
  const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;
  return query ? `${base}?${query}` : base;
}

export function suggestCategory(sector, name = '') {
  const haystack = `${sector || ''} ${name || ''}`;
  for (const [re, category] of SECTOR_CATEGORY_HINTS) {
    if (re.test(haystack)) return category;
  }
  return null;
}

async function awinGet(env, path, params = {}) {
  const url = new URL(AWIN_API_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: awinHeaders(env) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Awin ${path} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function getPublisherId(env) {
  const accounts = await awinGet(env, '/accounts');
  const list = Array.isArray(accounts) ? accounts : accounts.accounts || [];
  const publisher = list.find(a =>
    String(a.accountType || '').toLowerCase().includes('publisher')
  ) || list[0];
  if (!publisher?.accountId) throw new Error('No publisher account found for this Awin token');
  return publisher.accountId;
}

export async function fetchJoinedPrograms(env, publisherId) {
  return awinGet(env, `/publishers/${publisherId}/programmes`, {
    relationship: 'joined',
  });
}

export async function fetchProgramDetails(env, publisherId, advertiserId) {
  try {
    return await awinGet(env, `/publishers/${publisherId}/programmedetails`, {
      advertiserId: String(advertiserId),
    });
  } catch {
    return null;
  }
}

export async function fetchCommissionGroups(env, publisherId, advertiserId) {
  try {
    return await awinGet(env, `/publishers/${publisherId}/commissiongroups`, {
      advertiserId: String(advertiserId),
    });
  } catch {
    return null;
  }
}

/**
 * Download a program's Enhanced Feed (JSONL). Returns an array of products.
 * Respects the 5 req/min limit — callers must not hammer this in parallel.
 */
export async function fetchProductFeed(env, publisherId, advertiserId, locale = 'en_US') {
  const path = `/publishers/${publisherId}/awinfeeds/download/${advertiserId}-retail-${locale}.jsonl`;
  const url = AWIN_API_BASE + path;
  // No JSON Accept header here — this is a file download, not an API call.
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.AWIN_API_TOKEN}` },
  });
  if (res.status === 404 || res.status === 406) return []; // no feed for this program/locale
  if (!res.ok) {
    throw new Error(`Awin feed ${advertiserId} failed (HTTP ${res.status})`);
  }
  const text = await res.text();
  const products = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.meta) continue;
      products.push(obj);
    } catch {
      // skip malformed lines
    }
  }
  return products;
}

export async function generateTrackedLink(env, publisherId, advertiserId, destinationUrl, clickref) {
  const res = await fetch(`${AWIN_API_BASE}/publishers/${publisherId}/linkbuilder/generate`, {
    method: 'POST',
    headers: { ...awinHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      advertiserId,
      destinationUrl,
      parameters: clickref ? { clickref } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Link Builder failed (HTTP ${res.status})`);
  return res.json();
}

async function upsertRows(env, table, rows, onConflict) {
  if (!rows.length) return 0;
  const params = new URLSearchParams({ on_conflict: onConflict });
  const res = await fetch(supabaseUrl(env, table, params), {
    method: 'POST',
    headers: { ...supabaseHeaders(env), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase upsert to ${table} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return rows.length;
}

function parsePrice(value) {
  if (value == null) return null;
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function programToRow(p, details) {
  const commission = details
    ? { kpi: details.kpi || null, commissionRange: details.commissionRange || null }
    : null;
  return {
    advertiser_id: p.id,
    name: p.name,
    description: p.description || null,
    logo_url: p.logoUrl || null,
    display_url: p.displayUrl || null,
    click_through_url: p.clickThroughUrl,
    primary_region: p.primaryRegion?.name || p.primaryRegion?.countryCode || null,
    primary_sector: p.primarySector || null,
    currency_code: p.currencyCode || null,
    status: p.status || null,
    commission,
    // category is left null here; the sync step fills the suggestion only
    // when the row has no manual category set.
    category: suggestCategory(p.primarySector, p.name),
    raw: p,
    synced_at: new Date().toISOString(),
  };
}

function productToRow(advertiserId, p, fallbackCategory) {
  return {
    id: `${advertiserId}:${p.id}`,
    advertiser_id: advertiserId,
    title: p.title,
    description: p.description || null,
    link: p.link || null,
    tracked_url: null, // filled via Link Builder on demand, not bulk
    image_link: p.image_link || null,
    additional_images: p.additional_image_link || null,
    price: parsePrice(p.price),
    sale_price: parsePrice(p.sale_price),
    currency_code: null,
    brand: p.brand || null,
    availability: p.availability || null,
    category: fallbackCategory || null,
    raw: p,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Parse a CSV string into an array of objects. Handles quoted fields.
 */
function parseCsv(text) {
  const lines = text.split('\n');
  if (!lines.length) return [];
  // Remove BOM
  let header = lines[0].replace(/^\uFEFF/, '');
  const headers = splitCsvLine(header);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCsvLine(line);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    rows.push(obj);
  }
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Fetch the Darwin feed list and return active (joined) feeds.
 * Requires AWIN_FEED_LIST_URL worker secret.
 */
export async function fetchDarwinFeedList(env) {
  if (!env.AWIN_FEED_LIST_URL) return [];
  const res = await fetch(env.AWIN_FEED_LIST_URL);
  if (!res.ok) throw new Error(`Feed list failed (HTTP ${res.status})`);
  const text = await res.text();
  const rows = parseCsv(text);
  return rows.filter(r =>
    r['Membership Status'] === 'active' && r['URL']
  ).map(r => ({
    advertiserId: Number(r['Advertiser ID']),
    advertiserName: r['Advertiser Name'],
    feedUrl: r['URL'],
    format: r['Datafeed Format'],
    productCount: Number(r['No of products']) || 0,
  }));
}

/**
 * Download and parse a Darwin/legacy feed (gzipped CSV).
 */
export async function fetchDarwinFeed(feedUrl) {
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Feed download failed (HTTP ${res.status})`);
  const buffer = await res.arrayBuffer();
  // Decompress gzip using the platform's DecompressionStream
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([buffer]).stream().pipeThrough(ds);
  const text = await new Response(stream).text();
  return parseCsv(text);
}

/**
 * Pick the best image URL from a feed row.
 * Prefers direct CDN URLs over image proxy/thumbnail services,
 * since proxies often serve fixed small sizes with signed URLs.
 */
function pickBestImage(row) {
  const candidates = [
    row['image_link'],
    row['aw_image_url'],
    row['merchant_image_url'],
    row['lifestyle_image_link'],
    row['additional_image_link'],
  ].filter(Boolean);
  if (!candidates.length) return null;

  // Proxy/thumbnail services that typically serve small fixed-size images.
  const proxyPattern = /productserve\.com|images\.weserv\.nl|wsrv\.nl|thumbor/i;
  const direct = candidates.filter(url => !proxyPattern.test(url));
  // Prefer direct URLs; fall back to proxies if that's all we have.
  const pool = direct.length ? direct : candidates;

  // Among direct URLs, prefer ones without explicit small-size params.
  const smallParam = /[?&](w|width|h|height|size)=\d{1,3}([&#]|$)/i;
  const fullSize = pool.filter(url => !smallParam.test(url));
  return (fullSize.length ? fullSize : pool)[0];
}

function darwinRowToProduct(advertiserId, row, fallbackCategory) {
  // Supports both Google/Darwin format and legacy Awin CSV format
  const id = row['id'] || row['aw_product_id'];
  const title = row['title'] || row['product_name'];
  if (!id || !title) return null;
  return {
    id: `${advertiserId}:${id}`,
    advertiser_id: advertiserId,
    title,
    description: (row['description'] || '').slice(0, 500) || null,
    link: row['link'] || row['merchant_deep_link'] || null,
    tracked_url: row['aw_deep_link'] || null,
    image_link: pickBestImage(row),
    additional_images: row['additional_image_link'] || null,
    price: parsePrice(row['price'] || row['search_price']),
    sale_price: parsePrice(row['sale_price']),
    currency_code: null,
    brand: row['brand'] || row['brand_name'] || null,
    availability: row['availability'] || row['stock_status'] || null,
    category: fallbackCategory || null,
    raw: row,
    synced_at: new Date().toISOString(),
  };
}
export async function syncAwin(env, options = {}) {
  if (!env.AWIN_API_TOKEN) throw new Error('AWIN_API_TOKEN is not configured');
  const { includeProducts = true, productLocale = 'en_US', maxPrograms = 50 } = options;
  const steps = [];
  const step = (name, status, detail) => steps.push({ name, status, detail, at: new Date().toISOString() });

  // Record the run.
  const runRes = await fetch(supabaseUrl(env, 'awin_sync_runs'), {
    method: 'POST',
    headers: { ...supabaseHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'running', steps: [] }),
  });
  if (!runRes.ok) {
    const body = await runRes.text().catch(() => '');
    throw new Error(`Could not record sync run (HTTP ${runRes.status}): ${body.slice(0, 200)}`);
  }
  const runRows = await runRes.json().catch(() => []);
  const runId = Array.isArray(runRows) ? runRows[0]?.id : null;

  const finish = async (status, error) => {
    if (runId) {
      await fetch(supabaseUrl(env, 'awin_sync_runs', `id=eq.${runId}`), {
        method: 'PATCH',
        headers: supabaseHeaders(env),
        body: JSON.stringify({
          status,
          finished_at: new Date().toISOString(),
          steps,
          error: error || null,
        }),
      }).catch(() => {});
    }
  };

  try {
    const publisherId = await getPublisherId(env);
    step('Resolve publisher account', 'ok', `publisherId ${publisherId}`);

    const programs = await fetchJoinedPrograms(env, publisherId);
    const list = (Array.isArray(programs) ? programs : []).slice(0, maxPrograms);
    step('Fetch joined programs', 'ok', `${list.length} programs`);

    // Enrich with details + commission (best effort, throttled).
    const rows = [];
    for (const p of list) {
      const details = await fetchProgramDetails(env, publisherId, p.id);
      const groups = await fetchCommissionGroups(env, publisherId, p.id);
      if (details && groups) {
        details.commissionGroups = groups.commissionGroups || groups;
      }
      rows.push(programToRow(p, details));
    }

    // Preserve manually-set categories: fetch existing, keep theirs.
    const existingRes = await fetch(
      supabaseUrl(env, 'awin_programs', new URLSearchParams({ select: 'advertiser_id,category' })),
      { headers: supabaseHeaders(env) }
    );
    const manual = new Map();
    if (existingRes.ok) {
      const existingRows = await existingRes.json().catch(() => []);
      for (const r of Array.isArray(existingRows) ? existingRows : []) {
        if (r.category) manual.set(Number(r.advertiser_id), r.category);
      }
    }
    for (const r of rows) {
      if (manual.has(r.advertiser_id)) r.category = manual.get(r.advertiser_id);
    }

    const upserted = await upsertRows(env, 'awin_programs', rows, 'advertiser_id');
    step('Upsert programs', 'ok', `${upserted} rows`);

    let productCount = 0;
    if (includeProducts) {
      // Try Darwin/legacy feeds first (bulk, has pre-tagged links).
      try {
        const darwinFeeds = await fetchDarwinFeedList(env);
        step('Fetch Darwin feed list', 'ok', `${darwinFeeds.length} active feeds`);
        for (const feed of darwinFeeds) {
          try {
            const rows = await fetchDarwinFeed(feed.feedUrl);
            const cat = manual.get(feed.advertiserId)
              || suggestCategory(null, feed.advertiserName);
            const prows = rows
              .map(r => darwinRowToProduct(feed.advertiserId, r, cat))
              .filter(Boolean);
            const n = await upsertRows(env, 'awin_products', prows, 'id');
            productCount += n;
            step(`Feed: ${feed.advertiserName}`, 'ok', `${n} products`);
          } catch (e) {
            step(`Feed: ${feed.advertiserName}`, 'skipped', e.message.slice(0, 120));
          }
        }
      } catch (e) {
        step('Darwin feeds', 'skipped', e.message.slice(0, 120));
      }
      // Fall back to REST Enhanced Feeds for programs without Darwin feeds.
      for (const p of list) {
        try {
          const products = await fetchProductFeed(env, publisherId, p.id, productLocale);
          if (!products.length) continue;
          const cat = manual.get(Number(p.id)) || suggestCategory(p.primarySector, p.name);
          const prows = products
            .filter(pr => pr.title && pr.id)
            .map(pr => productToRow(p.id, pr, cat));
          productCount += await upsertRows(env, 'awin_products', prows, 'id');
          // Respect the 5 req/min feed limit.
          await new Promise(r => setTimeout(r, 13000));
        } catch (e) {
          step(`Feed: ${p.name}`, 'skipped', e.message.slice(0, 120));
        }
      }
      step('Upsert products', 'ok', `${productCount} products`);
    }

    await finish('success');
    return { ok: true, steps, programs: upserted, products: productCount };
  } catch (error) {
    await finish('failed', error.message);
    return { ok: false, steps, error: error.message };
  }
}

/**
 * Read Awin ads from Supabase for the public /ads endpoint and admin panel.
 * Returns ads in the worker's ad shape.
 */
export async function getAwinAds(env, { category = 'all', query = '' } = {}) {
  const params = new URLSearchParams({
    select: 'id,advertiser_id,title,description,link,tracked_url,image_link,price,sale_price,brand,availability,category',
    enabled: 'eq.true',
    order: 'synced_at.desc',
    limit: '200',
  });
  if (category && category !== 'all') params.set('category', `eq.${category}`);

  const [prodRes, progRes] = await Promise.all([
    fetch(supabaseUrl(env, 'awin_products', params), { headers: supabaseHeaders(env) }),
    fetch(
      supabaseUrl(env, 'awin_programs', new URLSearchParams({
        select: 'advertiser_id,name,description,logo_url,click_through_url,category',
        enabled: 'eq.true',
        ...(category && category !== 'all' ? { category: `eq.${category}` } : {}),
      })),
      { headers: supabaseHeaders(env) }
    ),
  ]);

  const ads = [];
  // Map advertiser_id -> program name for product sponsor labels.
  const progRows = progRes.ok ? await progRes.json().catch(() => []) : [];
  const progNameById = new Map();
  for (const p of Array.isArray(progRows) ? progRows : []) {
    progNameById.set(Number(p.advertiser_id), p.name);
  }
  if (prodRes.ok) {
    const prodRows = await prodRes.json().catch(() => []);
    for (const p of Array.isArray(prodRows) ? prodRows : []) {
      ads.push({
        id: `awin-product-${p.id}`,
        title: p.title,
        desc: p.description || '',
        img: p.image_link || '',
        url: p.tracked_url || p.link || '#',
        sponsor: progNameById.get(Number(p.advertiser_id)) || p.brand || 'Awin Partner',
        cta: p.sale_price || p.price ? 'Shop now →' : 'Learn more →',
        price: p.sale_price || p.price || null,
        category: p.category || 'all',
        network: 'Awin',
      });
    }
  }
  if (progRes.ok) {
    for (const p of Array.isArray(progRows) ? progRows : []) {
      ads.push({
        id: `awin-program-${p.advertiser_id}`,
        title: p.name,
        desc: p.description || '',
        img: p.logo_url || '',
        url: p.click_through_url,
        sponsor: p.name,
        cta: 'Visit store →',
        category: p.category || 'all',
        network: 'Awin',
      });
    }
  }

  if (query && query.trim()) {
    const q = query.toLowerCase();
    return ads.filter(a =>
      `${a.title} ${a.desc} ${a.sponsor}`.toLowerCase().includes(q)
    );
  }
  return ads;
}
