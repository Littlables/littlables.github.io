export function getAdminLoginPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Littlables admin sign in</title>
  <style>
    :root { color-scheme: dark; font: 16px/1.5 system-ui, sans-serif; background: #0b0f19; color: #f8fafc; }
    body { min-height: 100vh; display: grid; place-items: center; margin: 0; padding: 1rem; }
    main { max-width: 28rem; padding: 2rem; background: #1e293b; border: 1px solid #334155; border-radius: 12px; }
    a { display: inline-block; margin-top: 1rem; padding: .7rem 1rem; border-radius: 8px; color: white; background: #4f46e5; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <main>
    <h1>Littlables news admin</h1>
    <p>Sign in with the authorized GitHub account to manage stories and providers.</p>
    <a href="/admin/auth/login">Continue with GitHub</a>
  </main>
</body>
</html>`;
}

export function getAdminPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Littlables news admin</title>
  <style>
    :root { color-scheme: dark; font: 16px/1.5 system-ui, sans-serif; background: #0b0f19; color: #f8fafc; }
    body { max-width: 1100px; margin: 0 auto; padding: 2rem 1rem 4rem; }
    h1, h2, h3 { line-height: 1.2; }
    .toolbar, .provider-head, .story, .ad-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .provider, .story, .ad-row, .summary, .admin-card-section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem; }
    .provider h2 { font-size: 1.1rem; margin: 0; }
    .provider p, .muted { color: #cbd5e1; }
    .provider-description, .provider-setup, .provider-coverage { margin: .45rem 0; font-size: .88rem; }
    .provider-setup.configured { color: #86efac; }
    .provider-setup.missing { color: #fcd34d; }
    .provider-toolbar { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .provider-filter { padding: .5rem .75rem; border: 1px solid #475569; border-radius: 8px; background: #0f172a; color: #f8fafc; font: inherit; }
    button { border: 0; border-radius: 8px; padding: .65rem 1rem; font: inherit; font-weight: 700; color: white; background: #4f46e5; cursor: pointer; transition: background 0.15s ease, opacity 0.15s ease; }
    button:hover:not(:disabled) { background: #4338ca; }
    button:disabled { opacity: .6; cursor: wait; }
    button.secondary { background: #475569; }
    button.secondary:hover:not(:disabled) { background: #334155; }
    button.small-btn { padding: .35rem .7rem; font-size: .82rem; }
    .section-toggle { padding: 0; background: transparent; text-align: left; }
    .section-toggle:hover { background: transparent; }
    a { color: #a5b4fc; }
    #stories, #pending-stories, #banned-stories, #ads-list, #story-search-results { display: grid; gap: .75rem; }
    #stories[hidden], #banned-stories[hidden], #providers[hidden], #ads-section[hidden] { display: none; }
    
    .story, .ad-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; align-items: center; gap: 1rem; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease; }
    .story:hover, .ad-row:hover { border-color: #6366f1; background-color: #243248; }
    .story:focus-visible, .ad-row:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }
    .story-main, .story-details, .ad-main, .ad-details { min-width: 0; }
    .story img, .ad-row img { width: 72px; height: 56px; object-fit: cover; border-radius: 6px; background: #334155; }
    .story h3, .ad-row h3 { font-size: 1rem; margin: 0 0 .4rem; overflow-wrap: anywhere; }
    .story-meta, .ad-meta { display: flex; flex-wrap: wrap; gap: .4rem; }
    .story-meta span, .ad-meta span { font-size: .8rem; font-weight: 650; }
    .meta-provider { color: #c4b5fd; }
    .meta-domain { color: #fcd34d; }
    .meta-category { color: #7dd3fc; }
    .meta-date { color: #86efac; }
    .meta-network { color: #fbbf24; background: rgba(245, 158, 11, 0.15); padding: 0.1rem 0.4rem; border-radius: 4px; }
    .meta-badge-status { padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; }
    .meta-approved { background: rgba(16, 185, 129, 0.2); color: #86efac; }
    .meta-pending { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
    .meta-banned { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
    .decision-note { margin: .4rem 0 0; color: #cbd5e1; font-size: .82rem; }
    .story-actions, .ad-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
    .story-actions button, .ad-actions button { white-space: nowrap; }
    .custom-input { box-sizing: border-box; width: 100%; padding: .8rem 1rem; border: 1px solid #475569; border-radius: 8px; background: #0f172a; color: #f8fafc; font: inherit; }
    .custom-input:focus { border-color: #818cf8; outline: none; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25); }

    /* Preview Modal Dialog */
    .preview-dialog { width: min(94vw, 480px); max-height: 94vh; overflow-y: auto; overflow-x: hidden; color: #f8fafc; background: #0b0f19; border: 1px solid #475569; border-radius: 16px; padding: 1.25rem; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7); }
    .preview-dialog::backdrop { background: rgb(2 6 23 / 80%); backdrop-filter: blur(4px); }
    
    /* Homepage Card Replica: .news-card */
    .news-card { overflow: hidden; display: flex; flex-direction: column; background: #1e293b; border: 1px solid #334155; border-radius: 14px; box-shadow: 0 4px 15px rgb(0 0 0 / 25%); margin-bottom: 1rem; transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .news-card-image-wrap { position: relative; width: 100%; height: 190px; overflow: hidden; background: #334155; }
    .news-card-image { display: block; width: 100%; height: 100%; object-fit: cover; }
    .news-card-badge { position: absolute; top: .75rem; left: .75rem; padding: .25rem .6rem; border-radius: 6px; background: #4f46e5; color: white; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
    .news-card-content { display: flex; flex: 1; flex-direction: column; gap: .75rem; padding: 1.25rem; }
    .news-card-meta { display: flex; justify-content: space-between; align-items: center; gap: .5rem; color: #cbd5e1; font-size: .75rem; flex-wrap: wrap; }
    .news-card-title { color: #f8fafc; font-size: 1.1rem; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; text-decoration: none; }
    .news-card-title:hover { color: #a5b4fc; text-decoration: none; }
    .news-card-desc { flex: 1; color: #cbd5e1; font-size: .85rem; line-height: 1.5; margin: 0; }
    
    /* AI Summary Callout matching homepage */
    .news-card-ai-summary { padding: .65rem .85rem; border-left: 3px solid #818cf8; border-radius: 0 8px 8px 0; background: #172554; color: #e0e7ff; font-size: .8rem; line-height: 1.45; }
    .news-card-ai-label { margin-bottom: .25rem; color: #c7d2fe; font-size: .68rem; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: .35rem; }
    .ai-summary-text { color: #e0e7ff; overflow-wrap: anywhere; }
    .summary-generate { padding: .45rem .75rem; background: #3730a3; font-size: .82rem; border-radius: 6px; margin-top: .25rem; }
    .summary-generate:hover:not(:disabled) { background: #4338ca; }
    
    /* Card Footer matching homepage */
    .news-card-footer { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; margin-top: auto; padding-top: .65rem; border-top: 1px solid rgb(255 255 255 / 8%); }
    .news-read-more-btn { display: inline-flex; align-items: center; gap: .35rem; font-size: .85rem; font-weight: 600; color: #a5b4fc; text-decoration: none; }
    .news-read-more-btn:hover { color: #c7d2fe; }
    
    /* Reaction pills replica */
    .news-card-reactions { display: flex; align-items: center; gap: .35rem; }
    .reaction-pill { display: inline-flex; align-items: center; gap: .25rem; padding: .25rem .5rem; border-radius: 9999px; font-size: .75rem; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); color: #cbd5e1; cursor: default; }
    .reaction-count { font-weight: 600; font-size: .75rem; }

    /* In-Feed Native Ad Card Replica matching homepage AdCard.tsx */
    .news-card-ad { border: 1px dashed rgba(245, 158, 11, 0.5); background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%); position: relative; }
    .news-card-ad:hover { border-color: #f59e0b; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.2); }
    .ad-badge { background: #f59e0b !important; color: #0b1120 !important; font-weight: 800 !important; letter-spacing: 0.6px !important; }
    .ad-sponsor-label { font-size: 0.68rem; text-transform: uppercase; font-weight: 800; color: #f59e0b; letter-spacing: 0.8px; }
    .ad-network-label { color: #f59e0b; font-size: 0.7rem; font-weight: bold; }
    .ad-card-title { color: #f8fafc; font-size: 1.05rem; }
    .ad-card-description { font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; font-family: inherit; }
    .ad-cta-btn { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 700; color: #fbbf24; text-decoration: none; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); padding: 0.35rem 0.75rem; border-radius: 6px; margin-top: auto; width: fit-content; }

    /* EDITABLE FIELD & REPLACING TEXT WITH FULL-WIDTH INPUT BOX */
    .preview-editable { display: inline-flex; align-items: flex-start; gap: .35rem; min-width: 0; width: 100%; position: relative; }
    .preview-editable.is-editing { display: block !important; width: 100% !important; margin: 0.35rem 0; }
    .preview-edit { flex: 0 0 auto; padding: .15rem .35rem; background: rgba(255,255,255,0.08); border-radius: 4px; font-size: .85rem; line-height: 1; cursor: pointer; color: #cbd5e1; transition: background 0.15s ease; }
    .preview-edit:hover { background: rgba(99, 102, 241, 0.3); color: white; }
    .preview-value { min-width: 0; overflow-wrap: anywhere; flex: 1; }
    
    /* When editing, the text content is replaced by the input box with full room to type */
    .preview-inline-editor { display: flex; flex-direction: column; width: 100%; box-sizing: border-box; gap: .45rem; margin-top: .2rem; }
    .preview-inline-editor input, .preview-inline-editor textarea, .preview-inline-editor select { box-sizing: border-box; width: 100%; min-width: 0; padding: .65rem .85rem; border: 1px solid #6366f1; border-radius: 8px; background: #0f172a; color: #f8fafc; font: inherit; font-size: .95rem; line-height: 1.45; outline: none; }
    .preview-inline-editor input:focus, .preview-inline-editor textarea:focus, .preview-inline-editor select:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3); }
    .preview-inline-editor textarea { min-height: 6.5rem; resize: vertical; }
    .editor-btn-row { display: flex; gap: .5rem; justify-content: flex-end; }
    .editor-btn-row button { padding: .4rem .75rem; font-size: .85rem; }
    
    .preview-image-edit { position: absolute; top: .6rem; right: .6rem; z-index: 10; width: auto !important; }
    .preview-category-edit { position: absolute; top: .75rem; left: .75rem; z-index: 10; width: auto !important; }
    .preview-category-edit .news-card-badge { position: static; }
    .preview-actions { display: flex; justify-content: space-between; gap: .5rem; padding-top: 1rem; border-top: 1px solid #334155; margin-top: 1rem; }
    .preview-actions .secondary { background: #475569; }
    .preview-context { color: #cbd5e1; font-size: .85rem; margin-top: 1rem; background: #1e293b; border: 1px solid #334155; padding: .75rem; border-radius: 8px; }
    .preview-card button { color: white; }
    .preview-dialog > .preview-close { display: block; margin: 1rem 0 0 auto; }
    
    .category-tabs { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    .category-tab { padding: .5rem .75rem; background: #334155; border-radius: 8px; }
    .category-tab[aria-pressed="true"] { background: #4f46e5; }
    .status { font-weight: 700; text-transform: capitalize; }
    .status-succeeded { color: #86efac; }
    .status-partial { color: #fcd34d; }
    .status-failed { color: #fca5a5; }
    .status-running { color: #7dd3fc; }
    .status-never { color: #cbd5e1; }
    .error { color: #fca5a5 !important; }
    .success { color: #86efac !important; }
    
    @media (max-width: 640px) {
      .toolbar, .provider-head { align-items: flex-start; flex-direction: column; }
      .story, .ad-row { grid-template-columns: 56px minmax(0, 1fr); gap: .75rem; }
      .story img, .ad-row img { width: 56px; height: 48px; }
      .story-actions, .ad-actions { grid-column: 2; justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <div><h1>Littlables news admin</h1><p id="identity" class="muted">Verifying GitHub session…</p></div>
    <div style="display: flex; gap: .5rem; flex-wrap: wrap;">
      <button id="refresh" type="button">Refresh data</button>
      <button id="logout" type="button">Sign out</button>
    </div>
  </header>

  <section class="summary" aria-live="polite">
    <h2>Saved story records: <span id="total">—</span></h2>
    <p id="message" class="muted">Loading database status…</p>
  </section>

  <!-- SEARCH STORIES SECTION -->
  <section class="admin-card-section" aria-labelledby="search-stories-title">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem;">
      <h2 id="search-stories-title" style="margin: 0;">🔍 Search Stories</h2>
      <button id="clear-story-search" class="secondary small-btn" type="button" style="display: none;">Clear Search</button>
    </div>
    <input id="story-search-input" class="custom-input" type="search" placeholder="Type to search stories across title, description, domain, provider, category..." aria-label="Search stories">
    <p id="story-search-count" class="muted" style="margin: .5rem 0 0; font-size: .88rem; display: none;"></p>
    <div id="story-search-results" style="margin-top: .75rem;"></div>
  </section>

  <!-- SPONSOR & AFFILIATE ADS SECTION -->
  <section class="admin-card-section" aria-labelledby="ads-title">
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
      <h2 id="ads-title" style="margin: 0;">
        <button id="ads-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="ads-section">
          <span id="ads-arrow" aria-hidden="true">▼</span> Sponsor & Affiliate Ads <span id="ads-count"></span>
        </button>
      </h2>
      <button id="create-ad-btn" type="button" class="small-btn">+ Add New Ad</button>
    </div>
    <div id="ads-section" style="margin-top: 1rem;">
      <div style="display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; margin-bottom: .75rem;">
        <input id="ad-search-input" class="custom-input" type="search" placeholder="Search ads by title, sponsor, network, cta, category..." aria-label="Search ads" style="flex: 1; min-width: 240px;">
        <label class="provider-toolbar" for="ads-network-filter">
          Network
          <select id="ads-network-filter" class="provider-filter">
            <option value="all">All Networks</option>
            <option value="Amazon">Amazon</option>
            <option value="TikTok">TikTok</option>
            <option value="Gumroad">Gumroad</option>
            <option value="Partner">Partner</option>
          </select>
        </label>
      </div>
      <nav id="ads-categories" class="category-tabs" aria-label="Filter ads by category" style="margin: .5rem 0 .75rem;"></nav>
      <p id="ads-results-count" class="muted" style="margin-bottom: .5rem; font-size: .88rem;"></p>
      <div id="ads-list"></div>
    </div>
  </section>

  <!-- CUSTOM ARTICLE PREVIEW INPUT -->
  <section aria-labelledby="custom-title" class="admin-card-section">
    <h2 id="custom-title" style="margin-top: 0;">Custom Story URL</h2>
    <input id="custom-link" class="custom-input" type="url" placeholder="Paste an article link to preview its card" aria-label="Paste an article link to preview its card">
  </section>

  <!-- UNIFIED PREVIEW DIALOG MATCHING HOMEPAGE EXACTLY -->
  <dialog id="preview-dialog" class="preview-dialog" aria-labelledby="preview-title">
    <div id="preview-card"></div>
    <button id="preview-close" class="preview-close secondary" type="button">Close preview</button>
  </dialog>

  <!-- PROVIDERS SECTION -->
  <section aria-labelledby="providers-title" class="admin-card-section">
    <h2 id="providers-title" style="margin: 0;">
      <button id="providers-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="providers">
        <span id="providers-arrow" aria-hidden="true">▼</span> News providers
      </button>
    </h2>
    <div id="providers" class="providers" aria-live="polite" hidden style="margin-top: 1rem;"></div>
  </section>

  <!-- PENDING STORIES SECTION -->
  <section aria-labelledby="pending-title" class="admin-card-section">
    <h2 id="pending-title" style="margin-top: 0;">Stories awaiting approval <span id="pending-count"></span></h2>
    <nav id="approval-categories" class="category-tabs" aria-label="Filter pending stories by category"></nav>
    <label class="provider-toolbar" for="approval-provider" style="margin-bottom: .75rem;">
      Provider
      <select id="approval-provider" class="provider-filter">
        <option value="all">All providers</option>
      </select>
    </label>
    <div id="pending-stories" aria-live="polite"></div>
  </section>

  <!-- DECIDED STORIES SECTION -->
  <section aria-labelledby="stories-title" class="admin-card-section">
    <h2 id="stories-title" style="margin: 0;">
      <button id="decisions-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="stories">
        <span id="decisions-arrow" aria-hidden="true">▼</span> Last 10 decided-on stories
      </button>
    </h2>
    <div id="stories" hidden style="margin-top: 1rem;"></div>
  </section>

  <!-- BANNED STORIES SECTION -->
  <section aria-labelledby="banned-title" class="admin-card-section">
    <h2 id="banned-title" style="margin: 0;">
      <button id="banned-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="banned-stories">
        <span id="banned-arrow" aria-hidden="true">▼</span> Banned stories
      </button>
    </h2>
    <div id="banned-stories" hidden style="margin-top: 1rem;"></div>
  </section>

  <script>
    const categories = [
      { id: 'all', label: 'Top Currents', icon: '⚡' },
      { id: 'childcare', label: 'Childcare & Family', icon: '👨‍👩‍👧' },
      { id: 'animals', label: 'Animals & Nature', icon: '🐾' },
      { id: 'arts', label: 'Creative Arts', icon: '🎨' },
      { id: 'tech', label: 'Future Tech & AI', icon: '🤖' },
      { id: 'world', label: 'Global Currents', icon: '🌍' },
      { id: 'uplifting', label: 'Uplifting News', icon: '✨' }
    ];
    const state = {
      busy: new Set(),
      approving: new Set(),
      banning: new Set(),
      unapproving: new Set(),
      undoing: new Set(),
      ignored: new Set(),
      previewTimer: null,
      previewType: 'story', // 'story' or 'ad'
      previewDraft: null,
      previewStoryId: null,
      previewAdDraft: null,
      previewAdId: null,
      generatingSummary: false,
      activeCategory: 'all',
      activeProvider: 'all',
      activeAdCategory: 'all',
      activeAdNetwork: 'all',
      adSearchQuery: '',
      storySearchQuery: '',
      storySearchTimer: null,
      providers: [],
      pendingStories: [],
      decidedStories: [],
      bannedStories: [],
      searchResults: [],
      ads: []
    };
    const providersEl = document.getElementById('providers');
    const messageEl = document.getElementById('message');
    const categoryEl = document.getElementById('approval-categories');
    const providerFilterEl = document.getElementById('approval-provider');
    const adsCategoriesEl = document.getElementById('ads-categories');
    const adsNetworkFilterEl = document.getElementById('ads-network-filter');
    const adsListEl = document.getElementById('ads-list');
    const adSearchInput = document.getElementById('ad-search-input');
    const storySearchInput = document.getElementById('story-search-input');
    const storySearchResultsEl = document.getElementById('story-search-results');
    const storySearchCountEl = document.getElementById('story-search-count');
    const clearStorySearchBtn = document.getElementById('clear-story-search');

    const text = (value) => value == null || value === '' ? '—' : String(value);
    const formatDateTime = (date) => date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

    function decodeHtmlEntities(value) {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = String(value ?? '').replace(/[<>]/g, character => (
        character === '<' ? '&lt;' : '&gt;'
      ));
      return textarea.value;
    }

    function getStoryDomain(link) {
      try {
        return new URL(link).hostname.replace(/^www\\./i, '');
      } catch {
        return 'Unknown domain';
      }
    }

    function formatElapsed(timestamp) {
      const elapsed = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
      const days = Math.floor(elapsed / 86400);
      const hours = Math.floor((elapsed % 86400) / 3600);
      const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const seconds = String(elapsed % 60).padStart(2, '0');
      if (days) return days + 'd' + String(hours).padStart(2, '0') + 'h' + minutes + 'm' + seconds + 's ago';
      if (hours) return hours + 'h' + minutes + 'm' + seconds + 's ago';
      return minutes + 'm' + seconds + 's ago';
    }

    function refreshStoryAges() {
      document.querySelectorAll('[data-updated-at]').forEach((element) => {
        const timestamp = Date.parse(element.dataset.updatedAt);
        if (!Number.isFinite(timestamp)) {
          element.textContent = element.dataset.updatedPrefix + 'Never';
          return;
        }
        element.textContent = element.dataset.updatedPrefix + formatDateTime(new Date(timestamp)) +
          '; ' + formatElapsed(timestamp);
      });
    }

    async function request(path, options) {
      const response = await fetch(path, options);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Request failed (HTTP ' + response.status + ')');
      return body;
    }

    function renderProviders(providers) {
      providersEl.replaceChildren();
      providers.forEach((provider) => {
        const card = document.createElement('article');
        card.className = 'provider';
        const head = document.createElement('div');
        head.className = 'provider-head';
        const title = document.createElement('h2');
        title.textContent = provider.name;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = state.busy.has(provider.id) ? 'Updating…' : 'Update';
        button.disabled = state.busy.has(provider.id) || provider.status === 'running' || !provider.configured;
        button.addEventListener('click', () => updateProvider(provider.id));
        head.append(title, button);
        const description = document.createElement('p');
        description.className = 'provider-description muted';
        description.textContent = provider.description || '';
        const coverage = document.createElement('p');
        coverage.className = 'provider-coverage muted';
        const topics = (provider.categories || []).map((id) => (
          categories.find((category) => category.id === id)?.label || id
        ));
        const pauseSeconds = Number(provider.update_pause_ms) / 1000;
        coverage.textContent = 'Topics: ' + topics.join(', ') +
          (Number.isFinite(pauseSeconds) && pauseSeconds > 0
            ? ' · ' + pauseSeconds + 's between topic requests'
            : '');
        const setup = document.createElement('p');
        setup.className = 'provider-setup ' + (provider.configured ? 'configured' : 'missing');
        setup.textContent = provider.credential_name
          ? provider.configured
            ? 'API key configured'
            : 'Set Worker secret: ' + provider.credential_name
          : 'No API key required';
        const status = document.createElement('p');
        status.append('Status: ');
        const statusValue = document.createElement('span');
        statusValue.className = 'status status-' + String(provider.status).toLowerCase();
        statusValue.textContent = text(provider.status);
        status.append(statusValue);
        const updated = document.createElement('p');
        updated.className = 'provider-updated';
        updated.dataset.updatedPrefix = 'Last updated: ';
        updated.dataset.updatedAt = provider.last_success_at || '';
        const saved = document.createElement('p');
        saved.textContent = 'Stories saved last run: ' + text(provider.stories_saved);
        const totalSaved = document.createElement('p');
        totalSaved.textContent = 'Total stories saved: ' + text(provider.total_stories_saved);
        card.append(head, description, coverage, setup, status, updated, saved, totalSaved);
        if (provider.last_error) {
          const error = document.createElement('p');
          error.className = 'error';
          error.textContent = provider.last_error;
          card.append(error);
        }
        providersEl.append(card);
      });
    }

    function renderCategoryTabs() {
      categoryEl.replaceChildren();
      categories.forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-tab';
        button.setAttribute('aria-pressed', String(state.activeCategory === category.id));
        button.textContent = category.icon + ' ' + category.label;
        button.addEventListener('click', () => {
          state.activeCategory = category.id;
          renderCategoryTabs();
          renderStories(state.pendingStories, { pending: true });
        });
        categoryEl.append(button);
      });
    }

    function renderAdsCategoryTabs() {
      adsCategoriesEl.replaceChildren();
      categories.forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-tab';
        button.setAttribute('aria-pressed', String(state.activeAdCategory === category.id));
        button.textContent = category.icon + ' ' + category.label;
        button.addEventListener('click', () => {
          state.activeAdCategory = category.id;
          renderAdsCategoryTabs();
          filterAndRenderAds();
        });
        adsCategoriesEl.append(button);
      });
    }

    function renderProviderFilter() {
      const selectedProvider = state.activeProvider;
      providerFilterEl.replaceChildren();
      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = 'All providers';
      providerFilterEl.append(allOption);
      state.providers.forEach((provider) => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;
        providerFilterEl.append(option);
      });
      state.activeProvider = state.providers.some(provider => provider.id === selectedProvider)
        ? selectedProvider
        : 'all';
      providerFilterEl.value = state.activeProvider;
    }

    function createStoryCardRow(story, { pending = false, decided = false, banned = false, isSearch = false } = {}) {
      const row = document.createElement('article');
      row.className = 'story';
      row.tabIndex = 0;
      row.setAttribute('aria-label', 'Edit story: ' + decodeHtmlEntities(story.title));
      row.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        openStoryPreview(story);
      });
      row.addEventListener('keydown', (event) => {
        if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openStoryPreview(story);
        }
      });
      if (story.image) {
        const image = document.createElement('img');
        image.src = story.image;
        image.alt = '';
        image.loading = 'lazy';
        image.onerror = () => { image.src = 'img/' + (story.category || 'all') + '_1.jpg'; };
        row.append(image);
      } else {
        const spacer = document.createElement('img');
        spacer.src = 'img/' + (story.category || 'all') + '_1.jpg';
        spacer.alt = '';
        row.append(spacer);
      }
      const title = document.createElement('h3');
      const link = document.createElement('a');
      link.href = decodeHtmlEntities(story.link);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = decodeHtmlEntities(story.title);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openStoryPreview(story);
      });
      title.append(link);
      const meta = document.createElement('p');
      meta.className = 'story-meta';
      [
        ['meta-provider', story.provider || 'unknown'],
        ['meta-domain', getStoryDomain(story.link)],
        ['meta-category', categories.find((category) => category.id === story.category)?.label || story.category],
      ].forEach(([className, value]) => {
        const item = document.createElement('span');
        item.className = className;
        item.textContent = value;
        meta.append(item);
      });
      const updated = document.createElement('span');
      updated.className = 'meta-date';
      updated.dataset.updatedPrefix = 'Last updated: ';
      updated.dataset.updatedAt = story.updatedAt || story.pubDate || '';
      meta.append(updated);

      if (isSearch) {
        const statusSpan = document.createElement('span');
        statusSpan.className = 'meta-badge-status ' + (story.removed ? 'meta-banned' : story.approved ? 'meta-approved' : 'meta-pending');
        statusSpan.textContent = story.removed ? 'Banned' : story.approved ? 'Approved' : 'Pending';
        meta.append(statusSpan);
      }

      const details = document.createElement('div');
      details.className = 'story-details';
      details.append(title, meta);
      if (decided) {
        const decision = document.createElement('p');
        decision.className = 'decision-note';
        const actionLabels = {
          approve: 'Approved',
          disapprove: 'Disapproved',
          unapprove: 'Disapproved',
          ban: 'Banned from the site',
          undo: 'Undid the previous decision'
        };
        decision.textContent = (actionLabels[story.decisionAction] || 'Decision updated') +
          ' · ' + (story.decisionBy ? '@' + story.decisionBy : 'admin');
        details.append(decision);
      }
      const main = document.createElement('div');
      main.className = 'story-main';
      main.append(details);
      row.append(main);

      const actions = document.createElement('div');
      actions.className = 'story-actions';
      
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary small-btn';
      editBtn.textContent = '✏️ Edit Preview';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStoryPreview(story);
      });
      actions.append(editBtn);

      if (pending) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'small-btn';
        button.textContent = state.approving.has(story.id) ? 'Approving…' : 'Approve';
        button.disabled = state.approving.has(story.id);
        button.addEventListener('click', () => approveStory(story.id));
        const disapproveButton = document.createElement('button');
        disapproveButton.type = 'button';
        disapproveButton.className = 'secondary small-btn';
        disapproveButton.textContent = state.unapproving.has(story.id) ? 'Disapproving…' : 'Disapprove';
        disapproveButton.disabled = state.unapproving.has(story.id);
        disapproveButton.addEventListener('click', () => disapproveStory(story.id));
        const ignoreButton = document.createElement('button');
        ignoreButton.type = 'button';
        ignoreButton.className = 'secondary small-btn';
        ignoreButton.textContent = 'Ignore';
        ignoreButton.addEventListener('click', () => {
          state.ignored.add(story.id);
          renderStories(state.pendingStories, { pending: true });
        });
        const banButton = document.createElement('button');
        banButton.type = 'button';
        banButton.className = 'secondary small-btn';
        banButton.textContent = state.banning.has(story.id) ? 'Banning…' : 'Ban';
        banButton.disabled = state.banning.has(story.id);
        banButton.addEventListener('click', () => banStory(story.id));
        actions.append(button, disapproveButton, ignoreButton, banButton);
      } else if (story.approved && !story.removed) {
        const disapproveButton = document.createElement('button');
        disapproveButton.type = 'button';
        disapproveButton.className = 'secondary small-btn';
        disapproveButton.textContent = state.unapproving.has(story.id) ? 'Disapproving…' : 'Disapprove';
        disapproveButton.disabled = state.unapproving.has(story.id);
        disapproveButton.addEventListener('click', () => disapproveStory(story.id));
        actions.append(disapproveButton);
      }
      if (
        (decided || banned) &&
        typeof story.previousApproved === 'boolean' &&
        typeof story.previousRemoved === 'boolean' &&
        !state.undoing.has(story.id)
      ) {
        const undoButton = document.createElement('button');
        undoButton.type = 'button';
        undoButton.className = 'secondary small-btn';
        undoButton.textContent = 'Undo';
        undoButton.addEventListener('click', () => undoDecision(story.id));
        actions.append(undoButton);
      } else if ((decided || banned) && state.undoing.has(story.id)) {
        const undoButton = document.createElement('button');
        undoButton.type = 'button';
        undoButton.className = 'secondary small-btn';
        undoButton.textContent = 'Undoing…';
        undoButton.disabled = true;
        actions.append(undoButton);
      }
      row.append(actions);
      return row;
    }

    function renderStories(stories, { pending = false, decided = false, banned = false } = {}) {
      const container = document.getElementById(pending ? 'pending-stories' : banned ? 'banned-stories' : 'stories');
      container.replaceChildren();
      const visibleStories = pending
        ? stories.filter((story) =>
          !state.ignored.has(story.id) &&
          (state.activeCategory === 'all' || story.category === state.activeCategory) &&
          (state.activeProvider === 'all' || story.provider === state.activeProvider))
        : stories;
      visibleStories.forEach((story) => {
        container.append(createStoryCardRow(story, { pending, decided, banned }));
      });
      if (!visibleStories.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = pending && state.activeProvider !== 'all'
          ? 'No stories awaiting approval from this provider in the selected category.'
          : pending && state.activeCategory !== 'all'
            ? 'No pending stories in this category.'
          : pending
            ? 'No stories awaiting approval.'
            : banned
              ? 'No banned stories.'
            : decided
              ? 'No stories have been decided yet.'
            : 'No stories have been saved yet.';
        container.append(empty);
      }
    }

    /* STORY SEARCH LOGIC */
    function performStorySearch() {
      const q = state.storySearchQuery.toLowerCase().trim();
      if (!q) {
        storySearchResultsEl.replaceChildren();
        storySearchCountEl.style.display = 'none';
        clearStorySearchBtn.style.display = 'none';
        return;
      }
      clearStorySearchBtn.style.display = 'inline-block';
      const allKnownStories = [
        ...state.pendingStories,
        ...state.decidedStories,
        ...state.bannedStories,
        ...state.searchResults
      ];
      const seen = new Set();
      const matched = [];
      allKnownStories.forEach((story) => {
        const key = story.id || story.link;
        if (seen.has(key)) return;
        seen.add(key);
        const matchTitle = (story.title || '').toLowerCase().includes(q);
        const matchDesc = (story.description || '').toLowerCase().includes(q);
        const matchSource = (story.source || '').toLowerCase().includes(q);
        const matchDomain = getStoryDomain(story.link).toLowerCase().includes(q);
        const matchCat = (story.category || '').toLowerCase().includes(q);
        const matchProvider = (story.provider || '').toLowerCase().includes(q);
        if (matchTitle || matchDesc || matchSource || matchDomain || matchCat || matchProvider) {
          matched.push(story);
        }
      });

      storySearchResultsEl.replaceChildren();
      storySearchCountEl.style.display = 'block';
      storySearchCountEl.textContent = 'Found ' + matched.length + ' matching stories for "' + q + '":';
      if (!matched.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No matching stories found.';
        storySearchResultsEl.append(empty);
      } else {
        matched.forEach((story) => {
          storySearchResultsEl.append(createStoryCardRow(story, { isSearch: true }));
        });
      }

      // Query database if query length >= 2
      if (q.length >= 2) {
        request('/admin/api/stories/search?q=' + encodeURIComponent(q))
          .then((data) => {
            if (data.items && data.items.length) {
              data.items.forEach((item) => {
                if (!seen.has(item.id || item.link)) {
                  seen.add(item.id || item.link);
                  matched.push(item);
                  storySearchResultsEl.append(createStoryCardRow(item, { isSearch: true }));
                }
              });
              storySearchCountEl.textContent = 'Found ' + matched.length + ' matching stories for "' + q + '":';
            }
          })
          .catch(() => {});
      }
    }

    storySearchInput.addEventListener('input', () => {
      state.storySearchQuery = storySearchInput.value;
      clearTimeout(state.storySearchTimer);
      state.storySearchTimer = setTimeout(performStorySearch, 250);
    });

    clearStorySearchBtn.addEventListener('click', () => {
      storySearchInput.value = '';
      state.storySearchQuery = '';
      performStorySearch();
    });

    /* ADS MANAGEMENT & SEARCH LOGIC */
    async function loadAds() {
      try {
        const data = await request('/admin/api/ads');
        state.ads = data.ads || [];
        filterAndRenderAds();
      } catch (err) {
        console.error('Failed to load ads:', err);
      }
    }

    function filterAndRenderAds() {
      const q = state.adSearchQuery.toLowerCase().trim();
      const cat = state.activeAdCategory;
      const net = state.activeAdNetwork;
      let filtered = state.ads.filter((ad) => {
        if (cat !== 'all' && ad.category !== cat && ad.category !== 'all') return false;
        if (net !== 'all' && (ad.network || '').toLowerCase() !== net.toLowerCase()) return false;
        if (q) {
          const matchTitle = (ad.title || '').toLowerCase().includes(q);
          const matchDesc = (ad.desc || '').toLowerCase().includes(q);
          const matchSponsor = (ad.sponsor || '').toLowerCase().includes(q);
          const matchCta = (ad.cta || '').toLowerCase().includes(q);
          const matchUrl = (ad.url || '').toLowerCase().includes(q);
          const matchCategory = (ad.category || '').toLowerCase().includes(q);
          const matchNetwork = (ad.network || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchSponsor && !matchCta && !matchUrl && !matchCategory && !matchNetwork) {
            return false;
          }
        }
        return true;
      });

      document.getElementById('ads-count').textContent = '(' + state.ads.length + ')';
      document.getElementById('ads-results-count').textContent = 'Showing ' + filtered.length + ' of ' + state.ads.length + ' ads:';
      adsListEl.replaceChildren();

      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No ads match the current filters.';
        adsListEl.append(empty);
        return;
      }

      filtered.forEach((ad) => {
        const row = document.createElement('article');
        row.className = 'ad-row';
        row.tabIndex = 0;
        row.setAttribute('aria-label', 'Edit ad: ' + decodeHtmlEntities(ad.title));
        row.addEventListener('click', (event) => {
          if (event.target.closest('button')) return;
          openAdPreview(ad);
        });
        row.addEventListener('keydown', (event) => {
          if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openAdPreview(ad);
          }
        });

        const image = document.createElement('img');
        image.src = ad.img || 'img/' + (ad.category || 'all') + '_1.jpg';
        image.alt = '';
        image.loading = 'lazy';
        image.onerror = () => { image.src = 'img/' + (ad.category || 'all') + '_1.jpg'; };
        row.append(image);

        const details = document.createElement('div');
        details.className = 'ad-details';
        const title = document.createElement('h3');
        title.textContent = decodeHtmlEntities(ad.title);
        const meta = document.createElement('p');
        meta.className = 'ad-meta';

        const sponsor = document.createElement('span');
        sponsor.className = 'meta-domain';
        sponsor.textContent = '📢 ' + (ad.sponsor || 'Featured Partner');
        
        const network = document.createElement('span');
        network.className = 'meta-network';
        network.textContent = ad.network || 'Partner';

        const catSpan = document.createElement('span');
        catSpan.className = 'meta-category';
        catSpan.textContent = categories.find(c => c.id === ad.category)?.label || ad.category;

        const ctaSpan = document.createElement('span');
        ctaSpan.className = 'meta-provider';
        ctaSpan.textContent = 'CTA: ' + (ad.cta || 'Learn More →');

        meta.append(sponsor, network, catSpan, ctaSpan);
        details.append(title, meta);
        row.append(details);

        const actions = document.createElement('div');
        actions.className = 'ad-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'secondary small-btn';
        editBtn.textContent = '✏️ Edit Ad Preview';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAdPreview(ad);
        });
        actions.append(editBtn);
        row.append(actions);

        adsListEl.append(row);
      });
    }

    adSearchInput.addEventListener('input', () => {
      state.adSearchQuery = adSearchInput.value;
      filterAndRenderAds();
    });

    adsNetworkFilterEl.addEventListener('change', () => {
      state.activeAdNetwork = adsNetworkFilterEl.value;
      filterAndRenderAds();
    });

    document.getElementById('ads-toggle').addEventListener('click', (event) => {
      const content = document.getElementById('ads-section');
      const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
      event.currentTarget.setAttribute('aria-expanded', String(!expanded));
      document.getElementById('ads-arrow').textContent = expanded ? '▼' : '▲';
      content.hidden = expanded;
    });

    document.getElementById('create-ad-btn').addEventListener('click', () => {
      openAdPreview(null);
    });

    async function refreshData() {
      messageEl.className = 'muted';
      messageEl.textContent = 'Refreshing database status…';
      try {
        const query = state.activeProvider === 'all'
          ? ''
          : '?provider=' + encodeURIComponent(state.activeProvider);
        const data = await request('/admin/api/status' + query);
        state.providers = data.providers;
        state.pendingStories = data.pendingStories || [];
        state.decidedStories = data.recentStories || [];
        state.bannedStories = data.bannedStories || [];
        renderProviders(data.providers);
        renderProviderFilter();
        document.getElementById('total').textContent = data.totalStories.toLocaleString();
        document.getElementById('pending-count').textContent = state.pendingStories.length
          ? '(' + state.pendingStories.length + (state.pendingStories.length === 100 ? '+' : '') + ')'
          : '';
        renderCategoryTabs();
        renderAdsCategoryTabs();
        renderStories(state.pendingStories, { pending: true });
        renderStories(state.decidedStories, { decided: true });
        renderStories(state.bannedStories, { banned: true });
        refreshStoryAges();
        loadAds();
        messageEl.textContent = 'Database status refreshed.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = error.message;
      }
    }

    async function approveStory(storyId) {
      if (state.approving.has(storyId)) return;
      state.approving.add(storyId);
      renderStories(state.pendingStories, { pending: true });
      try {
        await request('/admin/api/stories/' + encodeURIComponent(storyId) + '/approve', { method: 'POST' });
        await refreshData();
        messageEl.className = 'success';
        messageEl.textContent = 'Story approved and published.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Story approval failed: ' + error.message;
      } finally {
        state.approving.delete(storyId);
      }
    }

    async function postStoryDecision(storyId, action, busySet, successMessage) {
      if (busySet.has(storyId)) return;
      busySet.add(storyId);
      renderStories(state.pendingStories, { pending: true });
      renderStories(state.decidedStories, { decided: true });
      renderStories(state.bannedStories, { banned: true });
      try {
        await request('/admin/api/stories/' + encodeURIComponent(storyId) + '/' + action, { method: 'POST' });
        await refreshData();
        messageEl.className = 'success';
        messageEl.textContent = successMessage;
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Story decision failed: ' + error.message;
      } finally {
        busySet.delete(storyId);
        renderStories(state.pendingStories, { pending: true });
        renderStories(state.decidedStories, { decided: true });
        renderStories(state.bannedStories, { banned: true });
      }
    }

    function banStory(storyId) {
      return postStoryDecision(storyId, 'ban', state.banning, 'Story banned from public feeds.');
    }

    function disapproveStory(storyId) {
      return postStoryDecision(storyId, 'disapprove', state.unapproving, 'Story disapproved; it remains in the feed without the Littlables badge.');
    }

    function undoDecision(storyId) {
      return postStoryDecision(storyId, 'undo', state.undoing, 'Previous story decision undone.');
    }

    async function updateProvider(providerId) {
      if (state.busy.has(providerId)) return;
      state.busy.add(providerId);
      renderProviders(state.providers);
      messageEl.className = 'muted';
      messageEl.textContent = 'Updating ' + providerId + '…';
      try {
        const result = await request('/admin/api/providers/' + encodeURIComponent(providerId) + '/update', { method: 'POST' });
        messageEl.className = result.status === 'succeeded' ? 'success' : 'error';
        messageEl.textContent = result.status === 'succeeded'
          ? providerId + ': saved ' + result.storiesSaved + ' stories.'
          : providerId + ' update finished with errors: ' + (result.errors || []).join('; ');
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = providerId + ' update failed: ' + error.message;
      } finally {
        state.busy.delete(providerId);
        await refreshData();
      }
    }

    document.getElementById('refresh').addEventListener('click', refreshData);
    document.getElementById('decisions-toggle').addEventListener('click', (event) => {
      const content = document.getElementById('stories');
      const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
      event.currentTarget.setAttribute('aria-expanded', String(!expanded));
      document.getElementById('decisions-arrow').textContent = expanded ? '▼' : '▲';
      content.hidden = expanded;
    });
    document.getElementById('banned-toggle').addEventListener('click', (event) => {
      const content = document.getElementById('banned-stories');
      const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
      event.currentTarget.setAttribute('aria-expanded', String(!expanded));
      document.getElementById('banned-arrow').textContent = expanded ? '▼' : '▲';
      content.hidden = expanded;
    });

    function editButton(label, className = '') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preview-edit ' + className;
      button.textContent = '✏️';
      button.title = 'Edit ' + label;
      button.setAttribute('aria-label', 'Edit ' + label);
      return button;
    }

    /* EDITABLE FIELD REPLACING TEXT CONTENT WITH INPUT BOX */
    function editableField(parent, field, label, {
      tag = 'span',
      value = '',
      editor = 'text',
      className = '',
      display = value => value || 'Not set',
      onSave = null
    } = {}) {
      const currentDraft = state.previewType === 'ad' ? state.previewAdDraft : state.previewDraft;
      const actualValue = value || currentDraft?.[field] || '';
      const wrapper = document.createElement('span');
      wrapper.className = 'preview-editable ' + className;
      const visible = document.createElement(tag);
      visible.className = 'preview-value';
      if (field === 'title') {
        visible.classList.add(state.previewType === 'ad' ? 'ad-card-title' : 'news-card-title');
      }
      const displayValue = display(actualValue);
      if (displayValue instanceof Node) visible.append(displayValue);
      else visible.textContent = decodeHtmlEntities(displayValue);
      if (tag === 'a') {
        visible.href = currentDraft.link || currentDraft.url || '#';
        visible.target = '_blank';
        visible.rel = 'noopener noreferrer';
      }
      const pencil = editButton(label);
      pencil.addEventListener('click', (event) => {
        event.stopPropagation();
        // Replace text content with input box so there is ample room to type
        visible.style.display = 'none';
        pencil.style.display = 'none';
        wrapper.classList.add('is-editing');

        const editorWrap = document.createElement('div');
        editorWrap.className = 'preview-inline-editor';
        let input;
        if (editor === 'category') {
          input = document.createElement('select');
          categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.icon + ' ' + category.label;
            input.append(option);
          });
          input.value = actualValue || 'all';
        } else if (editor === 'network') {
          input = document.createElement('select');
          ['Amazon', 'TikTok', 'Gumroad', 'Partner'].forEach((net) => {
            const option = document.createElement('option');
            option.value = net;
            option.textContent = net;
            input.append(option);
          });
          input.value = actualValue || 'Partner';
        } else if (editor === 'textarea') {
          input = document.createElement('textarea');
          input.value = actualValue;
          input.rows = 4;
        } else {
          input = document.createElement('input');
          input.type = editor;
          input.value = editor === 'datetime-local' && actualValue
            ? (() => {
              const date = new Date(actualValue);
              date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
              return date.toISOString().slice(0, 16);
            })()
            : actualValue;
        }
        input.setAttribute('aria-label', label);
        input.placeholder = 'Enter ' + label + '…';

        const commitValue = () => {
          let next = input.value.trim();
          if (editor === 'datetime-local' && next) next = new Date(next).toISOString();
          currentDraft[field] = next;
          if (onSave) onSave(next);
          if (state.previewType === 'ad') renderAdPreview();
          else renderPreview();
        };

        const cancelValue = () => {
          if (state.previewType === 'ad') renderAdPreview();
          else renderPreview();
        };

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && editor !== 'textarea') {
            e.preventDefault();
            commitValue();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && editor === 'textarea') {
            e.preventDefault();
            commitValue();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelValue();
          }
        });

        const btnRow = document.createElement('div');
        btnRow.className = 'editor-btn-row';

        const done = document.createElement('button');
        done.type = 'button';
        done.textContent = 'Done';
        done.addEventListener('click', commitValue);

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', cancelValue);

        btnRow.append(done, cancel);
        editorWrap.append(input, btnRow);
        wrapper.append(editorWrap);
        input.focus();
        if (typeof input.select === 'function' && editor !== 'category' && editor !== 'network') {
          input.select();
        }
      });
      wrapper.append(visible, pencil);
      parent.append(wrapper);
      return wrapper;
    }

    /* STORY PREVIEW MATCHING HOMEPAGE EXACTLY */
    function renderPreview() {
      state.previewType = 'story';
      const draft = state.previewDraft;
      if (!draft) return;
      const preview = document.getElementById('preview-card');
      preview.replaceChildren();

      const card = document.createElement('article');
      card.className = 'news-card';

      const imageWrap = document.createElement('div');
      imageWrap.className = 'news-card-image-wrap';
      const stockImages = {
        all: 'all_1.jpg',
        childcare: 'childcare_1.jpg',
        animals: 'animals_1.jpg',
        arts: 'arts_1.jpg',
        tech: 'tech_1.jpg',
        world: 'world_1.jpg',
        uplifting: 'uplifting_1.jpg'
      };
      const image = document.createElement('img');
      image.className = 'news-card-image';
      image.src = draft.image || 'img/' + (stockImages[draft.category] || stockImages.all);
      image.alt = draft.title || '';
      image.onerror = () => { image.src = 'img/' + (stockImages[draft.category] || stockImages.all); };
      imageWrap.append(image);

      const category = categories.find(item => item.id === draft.category) || categories[0];
      editableField(imageWrap, 'category', 'category', {
        className: 'preview-category-edit',
        editor: 'category',
        display: () => {
          const badge = document.createElement('span');
          badge.className = 'news-card-badge';
          badge.textContent = category.icon + ' ' + category.label;
          return badge;
        }
      });
      editableField(imageWrap, 'image', 'image URL', {
        className: 'preview-image-edit',
        editor: 'url',
        display: () => ''
      });

      const content = document.createElement('div');
      content.className = 'news-card-content';
      const meta = document.createElement('div');
      meta.className = 'news-card-meta';
      const date = document.createElement('span');
      const displayDate = draft.pubDate
        ? new Date(draft.pubDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        : new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      editableField(date, 'pubDate', 'publication date', {
        display: () => '🕒 ' + displayDate,
        editor: 'datetime-local'
      });
      meta.append(date);
      if (draft.approved === true) {
        const approval = document.createElement('span');
        approval.textContent = "🧸 Littlables' Little Scoop";
        meta.append(approval);
      }
      editableField(meta, 'source', 'source name', { display: value => value || getStoryDomain(draft.link) });
      content.append(meta);

      const title = document.createElement('h3');
      title.className = 'news-card-title';
      title.id = 'preview-title';
      editableField(title, 'title', 'title', { tag: 'a', display: value => value || 'Untitled Update' });
      content.append(title);

      const description = document.createElement('p');
      description.className = 'news-card-desc';
      editableField(description, 'description', 'description', {
        tag: 'span',
        editor: 'textarea',
        display: value => value || 'No description was found on this page.'
      });
      content.append(description);

      const aiSummary = document.createElement('div');
      if (draft.aiSummary) {
        aiSummary.className = 'news-card-ai-summary';
        const aiLabel = document.createElement('div');
        aiLabel.className = 'news-card-ai-label';
        aiLabel.textContent = '✨ Quick AI Brief';
        aiSummary.append(aiLabel);
        const aiText = document.createElement('div');
        aiText.className = 'ai-summary-text';
        editableField(aiSummary, 'aiSummary', 'AI summary', {
          editor: 'textarea',
          display: value => value
        });
        content.append(aiSummary);
      }

      const generateSummary = document.createElement('button');
      generateSummary.type = 'button';
      generateSummary.className = 'summary-generate';
      generateSummary.textContent = state.generatingSummary ? 'Generating summary…' : 'Generate AI summary';
      generateSummary.disabled = state.generatingSummary;
      generateSummary.addEventListener('click', generatePreviewSummary);
      content.append(generateSummary);

      const footer = document.createElement('div');
      footer.className = 'news-card-footer';
      const readMore = document.createElement('a');
      readMore.className = 'news-read-more-btn';
      readMore.href = draft.link;
      readMore.target = '_blank';
      readMore.rel = 'noopener noreferrer';
      readMore.textContent = 'Read Full Story →';
      footer.append(readMore);

      editableField(footer, 'link', 'article URL', {
        tag: 'span',
        editor: 'url',
        display: () => '✏️ Link'
      });

      const reactions = document.createElement('div');
      reactions.className = 'news-card-reactions';
      ['❤️ 0', '🤯 0', '☕ 0'].forEach((r) => {
        const pill = document.createElement('span');
        pill.className = 'reaction-pill';
        pill.textContent = r;
        reactions.append(pill);
      });
      footer.append(reactions);

      card.append(imageWrap, content);
      preview.append(card);

      const context = document.createElement('div');
      context.className = 'preview-context';
      const contextTitle = document.createElement('strong');
      contextTitle.textContent = 'AI summary source content';
      context.append(contextTitle);
      editableField(context, 'content', 'AI summary source content', {
        editor: 'textarea',
        display: value => value || 'No extra source content'
      });
      preview.append(context);

      const actions = document.createElement('div');
      actions.className = 'preview-actions';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'secondary';
      close.textContent = 'Close';
      close.addEventListener('click', () => document.getElementById('preview-dialog').close());
      actions.append(close);

      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = state.previewStoryId === null ? 'Add to approved stories' : 'Save changes';
      save.addEventListener('click', () => savePreview(false));
      actions.append(save);

      if (state.previewStoryId !== null && draft.approved !== true && draft.removed !== true) {
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.textContent = 'Save & approve';
        approve.addEventListener('click', () => savePreview(true));
        actions.append(approve);
      }
      preview.append(actions);
    }

    /* AD PREVIEW MATCHING HOMEPAGE AD CARD EXACTLY */
    function renderAdPreview() {
      state.previewType = 'ad';
      const draft = state.previewAdDraft;
      if (!draft) return;
      const preview = document.getElementById('preview-card');
      preview.replaceChildren();

      const card = document.createElement('article');
      card.className = 'news-card news-card-ad';

      const imageWrap = document.createElement('div');
      imageWrap.className = 'news-card-image-wrap';
      const image = document.createElement('img');
      image.className = 'news-card-image';
      image.src = draft.img || 'img/' + (draft.category || 'all') + '_1.jpg';
      image.alt = draft.title || '';
      image.onerror = () => { image.src = 'img/' + (draft.category || 'all') + '_1.jpg'; };
      imageWrap.append(image);

      const badge = document.createElement('span');
      badge.className = 'news-card-badge ad-badge';
      badge.textContent = 'SPONSORED';
      imageWrap.append(badge);

      editableField(imageWrap, 'image', 'image URL', {
        className: 'preview-image-edit',
        editor: 'url',
        value: draft.img,
        display: () => '',
        onSave: (val) => { draft.img = val; }
      });

      const category = categories.find(item => item.id === draft.category) || categories[0];
      editableField(imageWrap, 'category', 'category', {
        className: 'preview-category-edit',
        editor: 'category',
        value: draft.category,
        display: () => {
          const catSpan = document.createElement('span');
          catSpan.className = 'news-card-badge';
          catSpan.style.background = '#0f172a';
          catSpan.textContent = category.icon + ' ' + category.label;
          return catSpan;
        },
        onSave: (val) => { draft.category = val; }
      });

      const content = document.createElement('div');
      content.className = 'news-card-content';

      const meta = document.createElement('div');
      meta.className = 'news-card-meta';
      const sponsorLabel = document.createElement('span');
      sponsorLabel.className = 'ad-sponsor-label';
      editableField(sponsorLabel, 'sponsor', 'sponsor name', {
        value: draft.sponsor,
        display: v => '📢 ' + (v || 'Featured Partner'),
        onSave: (val) => { draft.sponsor = val; }
      });
      meta.append(sponsorLabel);

      const networkLabel = document.createElement('span');
      networkLabel.className = 'ad-network-label';
      editableField(networkLabel, 'network', 'ad network', {
        editor: 'network',
        value: draft.network,
        display: v => v || 'Featured Partner',
        onSave: (val) => { draft.network = val; }
      });
      meta.append(networkLabel);
      content.append(meta);

      const title = document.createElement('h3');
      title.className = 'news-card-title ad-card-title';
      title.id = 'preview-title';
      editableField(title, 'title', 'ad title', {
        tag: 'a',
        value: draft.title,
        display: v => v || 'Curated Discovery',
        onSave: (val) => { draft.title = val; }
      });
      content.append(title);

      const desc = document.createElement('p');
      desc.className = 'news-card-desc ad-card-description';
      editableField(desc, 'desc', 'ad description', {
        editor: 'textarea',
        value: draft.desc,
        display: v => v || 'Add ad description here...',
        onSave: (val) => { draft.desc = val; }
      });
      content.append(desc);

      const footer = document.createElement('div');
      footer.className = 'news-card-footer';
      const ctaBtn = document.createElement('span');
      ctaBtn.className = 'ad-cta-btn';
      editableField(ctaBtn, 'cta', 'CTA button text', {
        value: draft.cta,
        display: v => v || 'Explore Free →',
        onSave: (val) => { draft.cta = val; }
      });
      footer.append(ctaBtn);

      editableField(footer, 'url', 'destination URL', {
        editor: 'url',
        value: draft.url,
        display: () => '✏️ Link URL',
        onSave: (val) => { draft.url = val; }
      });
      content.append(footer);

      card.append(imageWrap, content);
      preview.append(card);

      const actions = document.createElement('div');
      actions.className = 'preview-actions';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'secondary';
      close.textContent = 'Close';
      close.addEventListener('click', () => document.getElementById('preview-dialog').close());
      actions.append(close);

      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = state.previewAdId ? 'Save Ad changes' : 'Create & Save Ad';
      save.addEventListener('click', saveAdPreview);
      actions.append(save);

      preview.append(actions);
    }

    function openStoryPreview(story) {
      state.previewType = 'story';
      state.previewStoryId = story.id ?? null;
      state.previewDraft = {
        title: decodeHtmlEntities(story.title || ''),
        link: decodeHtmlEntities(story.link || ''),
        image: decodeHtmlEntities(story.image || ''),
        description: decodeHtmlEntities(story.description || ''),
        content: decodeHtmlEntities(story.content || ''),
        aiSummary: decodeHtmlEntities(story.aiSummary || ''),
        pubDate: story.pubDate || new Date().toISOString(),
        source: story.source || '',
        category: story.category || 'all',
        approved: story.approved === true,
        removed: story.removed === true
      };
      renderPreview();
      const dialog = document.getElementById('preview-dialog');
      if (!dialog.open) dialog.showModal();
    }

    function openAdPreview(ad) {
      state.previewType = 'ad';
      state.previewAdId = ad ? ad.id : null;
      state.previewAdDraft = ad ? { ...ad } : {
        id: 'ad-' + Date.now(),
        title: 'New Curated Discovery',
        desc: 'Handpicked products and creative tools tailored for mindful families and curious creators.',
        img: 'img/all_1.jpg',
        sponsor: 'Featured Partner',
        cta: 'Explore Now →',
        url: 'https://',
        category: 'all',
        network: 'Partner',
        price: 'Free'
      };
      renderAdPreview();
      const dialog = document.getElementById('preview-dialog');
      if (!dialog.open) dialog.showModal();
    }

    async function savePreview(approve) {
      const draft = state.previewDraft;
      const existingId = state.previewStoryId;
      try {
        if (existingId === null) {
          await request('/admin/api/stories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          });
        } else {
          await request('/admin/api/stories/' + encodeURIComponent(existingId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          });
          if (approve) {
            await request('/admin/api/stories/' + encodeURIComponent(existingId) + '/approve', { method: 'POST' });
          }
        }
        document.getElementById('preview-dialog').close();
        await refreshData();
        messageEl.className = 'success';
        messageEl.textContent = existingId === null
          ? 'Custom story added to the approved feed.'
          : approve
            ? 'Story changes saved and approved.'
            : 'Story changes saved.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not save story: ' + error.message;
      }
    }

    async function saveAdPreview() {
      const draft = state.previewAdDraft;
      const existingId = state.previewAdId;
      try {
        if (existingId) {
          await request('/admin/api/ads/' + encodeURIComponent(existingId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          });
          const idx = state.ads.findIndex(a => String(a.id) === String(existingId));
          if (idx !== -1) state.ads[idx] = { ...draft };
        } else {
          const res = await request('/admin/api/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          });
          if (res.ad) state.ads.unshift(res.ad);
          else state.ads.unshift(draft);
        }
        document.getElementById('preview-dialog').close();
        filterAndRenderAds();
        messageEl.className = 'success';
        messageEl.textContent = existingId ? 'Ad changes saved.' : 'New ad created and saved.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not save ad: ' + error.message;
      }
    }

    async function generatePreviewSummary() {
      if (!state.previewDraft || state.generatingSummary) return;
      state.generatingSummary = true;
      renderPreview();
      messageEl.className = 'muted';
      messageEl.textContent = 'Generating an AI summary from the current story details…';
      try {
        const result = await request('/admin/api/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.previewDraft)
        });
        state.previewDraft.aiSummary = result.summary;
        messageEl.className = 'success';
        messageEl.textContent = 'AI summary generated. Save the card to publish it.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not generate AI summary: ' + error.message;
      } finally {
        state.generatingSummary = false;
        renderPreview();
      }
    }

    async function parseCustomLink() {
      const input = document.getElementById('custom-link');
      const value = input.value.trim();
      if (!value) return;
      let url;
      try {
        url = new URL(value);
      } catch {
        messageEl.className = 'error';
        messageEl.textContent = 'Paste a valid article URL.';
        return;
      }
      if (!['http:', 'https:'].includes(url.protocol)) {
        messageEl.className = 'error';
        messageEl.textContent = 'Only HTTP and HTTPS links can be previewed.';
        return;
      }
      messageEl.className = 'muted';
      messageEl.textContent = 'Parsing custom article…';
      try {
        const data = await request('/admin/api/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.href })
        });
        openStoryPreview({
          ...data,
          pubDate: data.pubDate || new Date().toISOString(),
          category: state.activeCategory,
          provider: 'custom',
          approved: false,
          removed: false
        });
        messageEl.className = 'success';
        messageEl.textContent = 'Custom card preview ready.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not preview this link: ' + error.message;
      }
    }

    function queueCustomPreview() {
      clearTimeout(state.previewTimer);
      state.previewTimer = setTimeout(parseCustomLink, 500);
    }

    const customLink = document.getElementById('custom-link');
    customLink.addEventListener('input', queueCustomPreview);
    customLink.addEventListener('paste', () => setTimeout(queueCustomPreview, 0));
    document.getElementById('preview-close').addEventListener('click', () => {
      document.getElementById('preview-dialog').close();
    });
    request('/admin/api/identity')
      .then((data) => { document.getElementById('identity').textContent = 'Signed in as @' + data.login; })
      .catch((error) => { document.getElementById('identity').textContent = error.message; });
    document.getElementById('logout').addEventListener('click', async () => {
      try {
        const response = await fetch('/admin/logout', { method: 'POST' });
        if (!response.ok) throw new Error('Sign out failed (HTTP ' + response.status + ')');
        window.location.assign('/admin');
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = error.message;
      }
    });
    providerFilterEl.addEventListener('change', () => {
      state.activeProvider = providerFilterEl.value;
      refreshData();
    });
    document.getElementById('providers-toggle').addEventListener('click', (event) => {
      const button = event.currentTarget;
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      document.getElementById('providers-arrow').textContent = expanded ? '▲' : '▼';
      providersEl.hidden = !expanded;
    });
    refreshData();
    setInterval(refreshStoryAges, 1000);
    setInterval(() => {
      if (state.providers.some((provider) => provider.status === 'running')) refreshData();
    }, 15000);
  </script>
</body>
</html>`;
}
