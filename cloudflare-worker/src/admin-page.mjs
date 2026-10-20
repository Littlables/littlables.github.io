export function getAdminLoginPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Littlables admin sign in</title>
  <style>
    :root { color-scheme: dark; font: 16px/1.5 system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; }
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
    :root {
      color-scheme: dark;
      font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b0f19;
      color: #f8fafc;
      font-variant-numeric: tabular-nums;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html.modal-open,
    body.modal-open,
    html:has(dialog[open]),
    body:has(dialog[open]) {
      overflow: hidden !important;
      overscroll-behavior: none;
    }
    body {
      max-width: 1120px;
      margin: 0 auto;
      padding: 1.25rem 1rem 3.5rem;
    }
    h1, h2, h3 { line-height: 1.25; margin: 0; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.05rem; }
    a { color: #a5b4fc; }
    .muted { color: #94a3b8; margin: 0; font-size: .86rem; }

    /* Top Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .75rem;
      flex-wrap: wrap;
      padding-bottom: 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #1e293b;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex-wrap: wrap;
    }

    /* Buttons */
    button {
      border: 1px solid transparent;
      border-radius: 8px;
      padding: .45rem .75rem;
      font: inherit;
      font-size: .84rem;
      font-weight: 600;
      color: #ffffff;
      background: #4f46e5;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
    }
    button:hover:not(:disabled) { background: #4338ca; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.secondary { background: #334155; border-color: #475569; color: #f1f5f9; }
    button.secondary:hover:not(:disabled) { background: #475569; }
    button.small-btn { padding: .32rem .6rem; font-size: .78rem; border-radius: 6px; }
    button.icon-btn {
      padding: .28rem .5rem;
      font-size: .78rem;
      line-height: 1;
      background: #0f172a;
      border: 1px solid #334155;
      color: #cbd5e1;
      border-radius: 6px;
    }
    button.icon-btn:hover:not(:disabled) {
      background: #1e293b;
      border-color: #6366f1;
      color: #ffffff;
    }

    /* Collapsible & Reorderable Sections */
    #admin-sections {
      display: flex;
      flex-direction: column;
      gap: .85rem;
    }
    .admin-card-section, .summary {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: .85rem 1rem;
      margin: 0;
      transition: border-color 0.15s ease;
    }
    .admin-card-section.dragging {
      opacity: .6;
      border-color: #818cf8;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      flex-wrap: nowrap;
    }
    .section-header h2 {
      flex: 1;
      min-width: 0;
    }
    .section-toggle {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      width: 100%;
      padding: .15rem 0;
      background: transparent;
      border: 0;
      color: #f8fafc;
      font-size: 1rem;
      font-weight: 700;
      text-align: left;
      white-space: normal;
    }
    .section-toggle:hover:not(:disabled) { background: transparent; color: #c7d2fe; }
    .section-arrow {
      display: inline-block;
      width: 1.1rem;
      text-align: center;
      font-size: .78rem;
      color: #94a3b8;
      flex-shrink: 0;
    }
    .section-controls {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      flex-shrink: 0;
    }
    .section-body {
      margin-top: .85rem;
      padding-top: .85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
    }
    .section-body[hidden],
    #stories[hidden],
    #banned-stories[hidden],
    #providers[hidden],
    #ads-section[hidden] {
      display: none !important;
    }

    /* Providers Grid */
    .providers {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: .85rem;
    }
    .provider {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: .85rem;
    }
    .provider-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .5rem;
      margin-bottom: .35rem;
    }
    .provider h2 { font-size: .98rem; }
    .provider p { margin: .3rem 0; font-size: .82rem; color: #cbd5e1; }
    .provider-setup.configured { color: #86efac; }
    .provider-setup.missing { color: #fcd34d; }

    /* Filters & Inputs */
    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .65rem;
      flex-wrap: wrap;
      margin-bottom: .75rem;
    }
    .provider-toolbar {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      font-size: .82rem;
      color: #cbd5e1;
      flex-wrap: wrap;
    }
    .provider-filter, .page-size-select {
      padding: .35rem .6rem;
      border: 1px solid #475569;
      border-radius: 6px;
      background: #0f172a;
      color: #f8fafc;
      font: inherit;
      font-size: .82rem;
    }
    .custom-input {
      width: 100%;
      padding: .6rem .85rem;
      border: 1px solid #475569;
      border-radius: 8px;
      background: #0f172a;
      color: #f8fafc;
      font: inherit;
      font-size: .9rem;
    }
    .custom-input:focus {
      border-color: #818cf8;
      outline: none;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }

    /* Category Filter Tabs */
    .category-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: .35rem;
      margin: .5rem 0 .75rem;
    }
    .category-tab {
      padding: .32rem .6rem;
      font-size: .78rem;
      background: #0f172a;
      border: 1px solid #334155;
      color: #cbd5e1;
      border-radius: 6px;
    }
    .category-tab[aria-pressed="true"] {
      background: #4f46e5;
      border-color: #6366f1;
      color: #ffffff;
    }

    /* Story & Ad List Rows */
    #stories, #pending-stories, #banned-stories, #ads-list, #story-search-results {
      display: grid;
      gap: .6rem;
    }
    .story, .ad-row {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) auto;
      align-items: center;
      gap: .75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: .65rem .75rem;
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .story:hover, .ad-row:hover {
      border-color: #6366f1;
      background-color: #162033;
    }
    .story:focus-visible, .ad-row:focus-visible {
      outline: 2px solid #a5b4fc;
      outline-offset: 2px;
    }
    .story-main, .story-details, .ad-main, .ad-details { min-width: 0; }
    .story img, .ad-row img {
      width: 64px;
      height: 50px;
      object-fit: cover;
      border-radius: 6px;
      background: #1e293b;
      display: block;
    }
    .story h3, .ad-row h3 {
      font-size: .92rem;
      font-weight: 600;
      margin: 0 0 .25rem;
      overflow-wrap: anywhere;
    }
    .story h3 a { text-decoration: none; color: #f8fafc; }
    .story h3 a:hover { color: #a5b4fc; }
    .story-meta, .ad-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .35rem .5rem;
      margin: 0;
    }
    .story-meta span, .ad-meta span { font-size: .75rem; font-weight: 600; }
    .meta-provider { color: #c4b5fd; }
    .meta-domain { color: #fcd34d; }
    .meta-category { color: #7dd3fc; }
    .meta-date { color: #86efac; }
    .meta-network { color: #fbbf24; }
    .meta-badge-status {
      padding: 0.05rem 0.35rem;
      border-radius: 4px;
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
    }
    .meta-approved { background: rgba(16, 185, 129, 0.2); color: #86efac; }
    .meta-pending { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
    .meta-banned { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
    .decision-note { margin: .25rem 0 0; color: #94a3b8; font-size: .76rem; }
    .story-actions, .ad-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: .35rem;
    }

    /* Pagination Bar */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .6rem;
      flex-wrap: wrap;
      margin-top: .75rem;
      padding-top: .65rem;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      font-size: .8rem;
      color: #cbd5e1;
    }
    .pagination-bar[hidden] { display: none !important; }
    .pagination-info {
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
    }
    .pagination-controls {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
    }
    .pagination-page-label {
      padding: 0 .35rem;
      font-weight: 600;
      color: #f8fafc;
    }

    /* Preview Modal Dialog - Fixed Top Cut-off & Scroll Lock */
    .preview-dialog {
      width: min(94vw, 480px);
      max-height: calc(100dvh - 1.5rem);
      margin: auto;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      color: #f8fafc;
      background: #0b0f19;
      border: 1px solid #475569;
      border-radius: 16px;
      padding: 1.1rem;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8);
    }
    .preview-dialog::backdrop {
      background: rgb(2 6 23 / 82%);
      backdrop-filter: blur(4px);
    }

    /* Homepage Card Replica: .news-card */
    .news-card {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 14px;
      box-shadow: 0 4px 15px rgb(0 0 0 / 25%);
      margin-bottom: .85rem;
    }
    .news-card-image-wrap {
      position: relative;
      width: 100%;
      height: 190px;
      overflow: hidden;
      background: #334155;
    }
    .news-card-image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .news-card-badge {
      position: absolute;
      top: .75rem;
      left: .75rem;
      padding: .25rem .6rem;
      border-radius: 6px;
      background: #4f46e5;
      color: white;
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .news-card-content {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: .7rem;
      padding: 1.1rem;
    }
    .news-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: .5rem;
      color: #cbd5e1;
      font-size: .75rem;
      flex-wrap: wrap;
    }
    .news-card-title {
      color: #f8fafc;
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.35;
      overflow-wrap: anywhere;
      text-decoration: none;
    }
    .news-card-title:hover { color: #a5b4fc; text-decoration: none; }
    .news-card-desc {
      flex: 1;
      color: #cbd5e1;
      font-size: .85rem;
      line-height: 1.5;
      margin: 0;
    }

    /* AI Summary Callout matching homepage */
    .news-card-ai-summary {
      padding: .65rem .85rem;
      border-left: 3px solid #818cf8;
      border-radius: 0 8px 8px 0;
      background: #172554;
      color: #e0e7ff;
      font-size: .8rem;
      line-height: 1.45;
    }
    .news-card-ai-label {
      margin-bottom: .25rem;
      color: #c7d2fe;
      font-size: .68rem;
      font-weight: 800;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: .35rem;
    }
    .ai-summary-text { color: #e0e7ff; overflow-wrap: anywhere; }
    .summary-generate {
      padding: .4rem .7rem;
      background: #3730a3;
      font-size: .8rem;
      border-radius: 6px;
      align-self: flex-start;
    }
    .summary-generate:hover:not(:disabled) { background: #4338ca; }

    /* Card Footer matching homepage */
    .news-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
      margin-top: auto;
      padding-top: .65rem;
      border-top: 1px solid rgb(255 255 255 / 8%);
    }
    .news-read-more-btn {
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      font-size: .82rem;
      font-weight: 600;
      color: #a5b4fc;
      text-decoration: none;
    }
    .news-read-more-btn:hover { color: #c7d2fe; }
    .news-card-reactions { display: flex; align-items: center; gap: .3rem; }
    .reaction-pill {
      display: inline-flex;
      align-items: center;
      gap: .2rem;
      padding: .2rem .45rem;
      border-radius: 9999px;
      font-size: .72rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      cursor: default;
    }

    /* In-Feed Native Ad Card Replica */
    .news-card-ad {
      border: 1px dashed rgba(245, 158, 11, 0.5);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
      position: relative;
    }
    .ad-badge {
      background: #f59e0b !important;
      color: #0b1120 !important;
      font-weight: 800 !important;
      letter-spacing: 0.6px !important;
    }
    .ad-sponsor-label {
      font-size: 0.68rem;
      text-transform: uppercase;
      font-weight: 800;
      color: #f59e0b;
      letter-spacing: 0.8px;
    }
    .ad-network-label { color: #f59e0b; font-size: 0.7rem; font-weight: bold; }
    .ad-card-title { color: #f8fafc; font-size: 1.02rem; }
    .ad-card-description { font-size: 0.84rem; color: #cbd5e1; line-height: 1.5; }
    .ad-cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      font-weight: 700;
      color: #fbbf24;
      text-decoration: none;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 0.3rem 0.65rem;
      border-radius: 6px;
      width: fit-content;
    }

    /* Inline Field Editor */
    .preview-editable {
      display: inline-flex;
      align-items: flex-start;
      gap: .35rem;
      min-width: 0;
      width: 100%;
      position: relative;
    }
    .preview-editable.is-editing {
      display: block !important;
      width: 100% !important;
      margin: 0.3rem 0;
    }
    .preview-edit {
      flex: 0 0 auto;
      padding: .15rem .35rem;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      font-size: .78rem;
      line-height: 1;
      cursor: pointer;
      color: #cbd5e1;
    }
    .preview-edit:hover { background: #4f46e5; color: white; }
    .preview-value { min-width: 0; overflow-wrap: anywhere; flex: 1; }
    .preview-inline-editor {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: .4rem;
      margin-top: .15rem;
      background: rgba(15, 23, 42, 0.92);
      padding: .45rem;
      border-radius: 8px;
      border: 1px solid #475569;
    }
    .preview-inline-editor input,
    .preview-inline-editor textarea,
    .preview-inline-editor select {
      width: 100%;
      min-width: 0;
      padding: .55rem .7rem;
      border: 1px solid #6366f1;
      border-radius: 6px;
      background: #0b0f19;
      color: #f8fafc;
      font: inherit;
      font-size: .9rem;
      line-height: 1.4;
      outline: none;
    }
    .preview-inline-editor textarea { min-height: 5.5rem; resize: vertical; }
    .editor-btn-row { display: flex; gap: .4rem; justify-content: flex-end; }
    .editor-btn-row button { padding: .3rem .65rem; font-size: .78rem; }

    .preview-image-edit { position: absolute; top: .6rem; right: .6rem; z-index: 10; width: auto !important; }
    .preview-image-edit.is-editing { left: .6rem; right: .6rem; width: calc(100% - 1.2rem) !important; }
    .preview-category-edit { position: absolute; top: .6rem; left: .6rem; z-index: 10; width: auto !important; }
    .preview-category-edit.is-editing { right: .6rem; width: calc(100% - 1.2rem) !important; }
    .preview-category-edit .news-card-badge { position: static; }
    .preview-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
      padding-top: .85rem;
      border-top: 1px solid #334155;
      margin-top: .85rem;
    }
    .preview-context {
      color: #cbd5e1;
      font-size: .82rem;
      margin-top: .75rem;
      background: #1e293b;
      border: 1px solid #334155;
      padding: .7rem;
      border-radius: 8px;
    }

    .status { font-weight: 700; text-transform: capitalize; }
    .status-succeeded { color: #86efac; }
    .status-partial { color: #fcd34d; }
    .status-failed { color: #fca5a5; }
    .status-running { color: #7dd3fc; }
    .status-never { color: #cbd5e1; }
    .error { color: #fca5a5 !important; }
    .success { color: #86efac !important; }

    @media (max-width: 640px) {
      body { padding: .85rem .65rem 2.5rem; }
      h1 { font-size: 1.2rem; }
      .admin-card-section, .summary { padding: .7rem .75rem; }
      .story, .ad-row {
        grid-template-columns: 52px minmax(0, 1fr);
        gap: .55rem;
        padding: .55rem;
      }
      .story img, .ad-row img { width: 52px; height: 42px; }
      .story-actions, .ad-actions {
        grid-column: 1 / -1;
        justify-content: flex-start;
        padding-top: .25rem;
        border-top: 1px solid rgba(255,255,255,0.05);
      }
      .preview-dialog {
        width: 96vw;
        max-height: calc(100dvh - 1rem);
        padding: .85rem;
      }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <div>
      <h1>Littlables news admin</h1>
      <p id="identity" class="muted">Verifying GitHub session…</p>
    </div>
    <div class="toolbar-actions">
      <button id="refresh" class="small-btn" type="button">Refresh</button>
      <button id="reset-layout" class="secondary small-btn" type="button" title="Reset section order and collapse states">Reset layout</button>
      <button id="logout" class="secondary small-btn" type="button">Sign out</button>
    </div>
  </header>

  <main id="admin-sections">
    <!-- 1. DATABASE SUMMARY SECTION -->
    <section class="summary admin-card-section" data-section-id="summary" aria-live="polite">
      <div class="section-header">
        <h2 id="summary-title">
          <button id="summary-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="summary-body" data-section-toggle="summary">
            <span id="summary-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>Saved story records: <span id="total">—</span></span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="summary-body" class="section-body">
        <p id="message" class="muted">Loading database status…</p>
      </div>
    </section>

    <!-- 2. PENDING STORIES SECTION -->
    <section aria-labelledby="pending-title" class="admin-card-section" data-section-id="pending">
      <div class="section-header">
        <h2 id="pending-title">
          <button id="pending-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="pending-body" data-section-toggle="pending">
            <span id="pending-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>Stories awaiting approval <span id="pending-count"></span></span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="pending-body" class="section-body">
        <nav id="approval-categories" class="category-tabs" aria-label="Filter pending stories by category"></nav>
        <div class="filter-bar">
          <label class="provider-toolbar" for="approval-provider">
            Provider
            <select id="approval-provider" class="provider-filter">
              <option value="all">All providers</option>
            </select>
          </label>
        </div>
        <div id="pending-stories" aria-live="polite"></div>
        <div id="pending-pagination" class="pagination-bar"></div>
      </div>
    </section>

    <!-- 3. SEARCH STORIES SECTION -->
    <section class="admin-card-section" data-section-id="search" aria-labelledby="search-stories-title">
      <div class="section-header">
        <h2 id="search-stories-title">
          <button id="search-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="search-body" data-section-toggle="search">
            <span id="search-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>Search Stories</span>
          </button>
        </h2>
        <div class="section-controls">
          <button id="clear-story-search" class="secondary small-btn" type="button" style="display: none;">Clear</button>
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="search-body" class="section-body">
        <input id="story-search-input" class="custom-input" type="search" placeholder="Search stories by title, description, domain, provider, category..." aria-label="Search stories">
        <p id="story-search-count" class="muted" style="margin: .5rem 0; display: none;"></p>
        <div id="story-search-results" style="margin-top: .5rem;"></div>
        <div id="search-pagination" class="pagination-bar" hidden></div>
      </div>
    </section>

    <!-- 4. SPONSOR & AFFILIATE ADS SECTION -->
    <section class="admin-card-section" data-section-id="ads" aria-labelledby="ads-title">
      <div class="section-header">
        <h2 id="ads-title">
          <button id="ads-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="ads-section" data-section-toggle="ads">
            <span id="ads-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>Sponsor & Affiliate Ads <span id="ads-count"></span></span>
          </button>
        </h2>
        <div class="section-controls">
          <button id="create-ad-btn" type="button" class="small-btn">+ New Ad</button>
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="ads-section" class="section-body">
        <div class="filter-bar">
          <input id="ad-search-input" class="custom-input" type="search" placeholder="Search ads by title, sponsor, network, CTA..." aria-label="Search ads" style="flex: 1; min-width: 200px;">
          <label class="provider-toolbar" for="ads-network-filter">
            Network
            <select id="ads-network-filter" class="provider-filter">
              <option value="all">All</option>
              <option value="Amazon">Amazon</option>
              <option value="TikTok">TikTok</option>
              <option value="Gumroad">Gumroad</option>
              <option value="Partner">Partner</option>
            </select>
          </label>
        </div>
        <nav id="ads-categories" class="category-tabs" aria-label="Filter ads by category"></nav>
        <p id="ads-results-count" class="muted" style="margin-bottom: .5rem;"></p>
        <div id="ads-list"></div>
        <div id="ads-pagination" class="pagination-bar"></div>
      </div>
    </section>

    <!-- 5. CUSTOM ARTICLE PREVIEW INPUT -->
    <section aria-labelledby="custom-title" class="admin-card-section" data-section-id="custom">
      <div class="section-header">
        <h2 id="custom-title">
          <button id="custom-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="custom-body" data-section-toggle="custom">
            <span id="custom-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>Custom Story URL</span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="custom-body" class="section-body">
        <input id="custom-link" class="custom-input" type="url" placeholder="Paste an article link to preview its card" aria-label="Paste an article link to preview its card">
      </div>
    </section>

    <!-- 6. PROVIDERS SECTION -->
    <section aria-labelledby="providers-title" class="admin-card-section" data-section-id="providers">
      <div class="section-header">
        <h2 id="providers-title">
          <button id="providers-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="providers" data-section-toggle="providers">
            <span id="providers-arrow" class="section-arrow" aria-hidden="true">▼</span>
            <span>News providers</span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="providers" class="providers" aria-live="polite" hidden style="margin-top: .85rem;"></div>
    </section>

    <!-- 7. DECIDED STORIES SECTION -->
    <section aria-labelledby="stories-title" class="admin-card-section" data-section-id="decisions">
      <div class="section-header">
        <h2 id="stories-title">
          <button id="decisions-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="stories" data-section-toggle="decisions">
            <span id="decisions-arrow" class="section-arrow" aria-hidden="true">▼</span>
            <span>Last 10 decided-on stories</span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="decisions-body" class="section-body" hidden>
        <div id="stories" aria-controls="stories"></div>
        <div id="decided-pagination" class="pagination-bar"></div>
      </div>
    </section>

    <!-- 8. BANNED STORIES SECTION -->
    <section aria-labelledby="banned-title" class="admin-card-section" data-section-id="banned">
      <div class="section-header">
        <h2 id="banned-title">
          <button id="banned-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="banned-stories" data-section-toggle="banned">
            <span id="banned-arrow" class="section-arrow" aria-hidden="true">▼</span>
            <span>Banned stories</span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="banned-body" class="section-body" hidden>
        <div id="banned-stories"></div>
        <div id="banned-pagination" class="pagination-bar"></div>
      </div>
    </section>
  </main>

  <!-- UNIFIED PREVIEW DIALOG (Single Close Button inside Preview Actions) -->
  <dialog id="preview-dialog" class="preview-dialog" aria-labelledby="preview-title">
    <div id="preview-card"></div>
  </dialog>

  <script>
    const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
    const STORAGE_ORDER_KEY = 'littlables_admin_section_order_v1';
    const STORAGE_COLLAPSED_KEY = 'littlables_admin_collapsed_v1';
    const STORAGE_PAGE_SIZES_KEY = 'littlables_admin_page_sizes_v1';

    const categories = [
      { id: 'all', label: 'Top Currents', icon: '⚡' },
      { id: 'childcare', label: 'Childcare & Family', icon: '👨‍👩‍👧' },
      { id: 'animals', label: 'Animals & Nature', icon: '🐾' },
      { id: 'arts', label: 'Creative Arts', icon: '🎨' },
      { id: 'tech', label: 'Future Tech & AI', icon: '🤖' },
      { id: 'world', label: 'Global Currents', icon: '🌍' },
      { id: 'uplifting', label: 'Uplifting News', icon: '✨' }
    ];

    function loadSavedPageSizes() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_PAGE_SIZES_KEY) || '{}');
        return {
          pending: PAGE_SIZE_OPTIONS.includes(Number(saved.pending)) ? Number(saved.pending) : 10,
          search: PAGE_SIZE_OPTIONS.includes(Number(saved.search)) ? Number(saved.search) : 10,
          ads: PAGE_SIZE_OPTIONS.includes(Number(saved.ads)) ? Number(saved.ads) : 10,
          decided: PAGE_SIZE_OPTIONS.includes(Number(saved.decided)) ? Number(saved.decided) : 10,
          banned: PAGE_SIZE_OPTIONS.includes(Number(saved.banned)) ? Number(saved.banned) : 10
        };
      } catch {
        return { pending: 10, search: 10, ads: 10, decided: 10, banned: 10 };
      }
    }

    const state = {
      busy: new Set(),
      approving: new Set(),
      banning: new Set(),
      unapproving: new Set(),
      undoing: new Set(),
      ignored: new Set(),
      previewTimer: null,
      previewType: 'story',
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
      ads: [],
      pages: {
        pending: 1,
        search: 1,
        ads: 1,
        decided: 1,
        banned: 1
      },
      pageSizes: loadSavedPageSizes()
    };

    const adminSectionsEl = document.getElementById('admin-sections');
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
    const previewDialog = document.getElementById('preview-dialog');

    /* Lock background scroll when preview modal is open */
    function lockModalScroll() {
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
    }
    function unlockModalScroll() {
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    }
    previewDialog.addEventListener('close', unlockModalScroll);
    previewDialog.addEventListener('click', (event) => {
      if (event.target === previewDialog) previewDialog.close();
    });

    /* Collapsible & Reorderable Sections with localStorage persistence */
    const sectionTargets = {
      summary: { toggle: 'summary-toggle', arrow: 'summary-arrow', body: 'summary-body', defaultOpen: true },
      pending: { toggle: 'pending-toggle', arrow: 'pending-arrow', body: 'pending-body', defaultOpen: true },
      search: { toggle: 'search-toggle', arrow: 'search-arrow', body: 'search-body', defaultOpen: true },
      ads: { toggle: 'ads-toggle', arrow: 'ads-arrow', body: 'ads-section', defaultOpen: true },
      custom: { toggle: 'custom-toggle', arrow: 'custom-arrow', body: 'custom-body', defaultOpen: true },
      providers: { toggle: 'providers-toggle', arrow: 'providers-arrow', body: 'providers', defaultOpen: false },
      decisions: { toggle: 'decisions-toggle', arrow: 'decisions-arrow', body: 'decisions-body', defaultOpen: false },
      banned: { toggle: 'banned-toggle', arrow: 'banned-arrow', body: 'banned-body', defaultOpen: false }
    };

    function setSectionExpanded(sectionId, expanded, persist = true) {
      const cfg = sectionTargets[sectionId];
      if (!cfg) return;
      const toggleBtn = document.getElementById(cfg.toggle);
      const arrowEl = document.getElementById(cfg.arrow);
      const bodyEl = document.getElementById(cfg.body);
      if (!toggleBtn || !arrowEl || !bodyEl) return;
      toggleBtn.setAttribute('aria-expanded', String(expanded));
      arrowEl.textContent = expanded ? '▲' : '▼';
      if (sectionId === 'providers') {
        providersEl.hidden = !expanded;
      } else {
        bodyEl.hidden = !expanded;
      }
      if (persist) {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_COLLAPSED_KEY) || '{}');
          saved[sectionId] = expanded;
          localStorage.setItem(STORAGE_COLLAPSED_KEY, JSON.stringify(saved));
        } catch {}
      }
    }

    function updateSectionMoveButtons() {
      const sections = Array.from(adminSectionsEl.querySelectorAll(':scope > section[data-section-id]'));
      sections.forEach((sec, idx) => {
        const upBtn = sec.querySelector('.move-up-btn');
        const downBtn = sec.querySelector('.move-down-btn');
        if (upBtn) upBtn.disabled = idx === 0;
        if (downBtn) downBtn.disabled = idx === sections.length - 1;
      });
    }

    function saveSectionOrder() {
      try {
        const order = Array.from(adminSectionsEl.querySelectorAll(':scope > section[data-section-id]'))
          .map(sec => sec.dataset.sectionId);
        localStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(order));
      } catch {}
      updateSectionMoveButtons();
    }

    function restoreSectionLayout() {
      try {
        const savedOrder = JSON.parse(localStorage.getItem(STORAGE_ORDER_KEY) || 'null');
        if (Array.isArray(savedOrder) && savedOrder.length) {
          savedOrder.forEach((id) => {
            const sec = adminSectionsEl.querySelector(':scope > section[data-section-id="' + id + '"]');
            if (sec) adminSectionsEl.append(sec);
          });
        }
      } catch {}
      try {
        const savedCollapsed = JSON.parse(localStorage.getItem(STORAGE_COLLAPSED_KEY) || '{}');
        Object.keys(sectionTargets).forEach((id) => {
          const expanded = typeof savedCollapsed[id] === 'boolean'
            ? savedCollapsed[id]
            : sectionTargets[id].defaultOpen;
          setSectionExpanded(id, expanded, false);
        });
      } catch {}
      updateSectionMoveButtons();
    }

    Object.keys(sectionTargets).forEach((sectionId) => {
      const cfg = sectionTargets[sectionId];
      const toggleBtn = document.getElementById(cfg.toggle);
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (event) => {
          const button = event.currentTarget;
          const expanded = button.getAttribute('aria-expanded') !== 'true';
          setSectionExpanded(sectionId, expanded, true);
        });
      }
    });

    adminSectionsEl.addEventListener('click', (event) => {
      const upBtn = event.target.closest('.move-up-btn');
      const downBtn = event.target.closest('.move-down-btn');
      if (!upBtn && !downBtn) return;
      const section = event.target.closest('section[data-section-id]');
      if (!section) return;
      if (upBtn && section.previousElementSibling) {
        adminSectionsEl.insertBefore(section, section.previousElementSibling);
        saveSectionOrder();
      } else if (downBtn && section.nextElementSibling) {
        adminSectionsEl.insertBefore(section.nextElementSibling, section);
        saveSectionOrder();
      }
    });

    document.getElementById('reset-layout').addEventListener('click', () => {
      try {
        localStorage.removeItem(STORAGE_ORDER_KEY);
        localStorage.removeItem(STORAGE_COLLAPSED_KEY);
      } catch {}
      ['summary', 'pending', 'search', 'ads', 'custom', 'providers', 'decisions', 'banned'].forEach((id) => {
        const sec = adminSectionsEl.querySelector(':scope > section[data-section-id="' + id + '"]');
        if (sec) adminSectionsEl.append(sec);
        setSectionExpanded(id, sectionTargets[id].defaultOpen, false);
      });
      updateSectionMoveButtons();
    });

    /* Reusable Pagination Renderer */
    function renderPaginationBar(containerId, listKey, totalItems, onRender) {
      const bar = document.getElementById(containerId);
      if (!bar) return { slice: (items) => items };
      const pageSize = state.pageSizes[listKey] || 10;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      if (state.pages[listKey] > totalPages) state.pages[listKey] = totalPages;
      if (state.pages[listKey] < 1) state.pages[listKey] = 1;
      const currentPage = state.pages[listKey];

      bar.replaceChildren();
      if (totalItems === 0) {
        bar.hidden = true;
        return { slice: () => [] };
      }
      bar.hidden = false;

      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = Math.min(totalItems, startIdx + pageSize);

      const info = document.createElement('div');
      info.className = 'pagination-info';

      const perPageLabel = document.createElement('label');
      perPageLabel.className = 'provider-toolbar';
      perPageLabel.textContent = 'Show ';
      const select = document.createElement('select');
      select.className = 'page-size-select';
      select.setAttribute('aria-label', 'Results per page');
      PAGE_SIZE_OPTIONS.forEach((size) => {
        const opt = document.createElement('option');
        opt.value = String(size);
        opt.textContent = String(size);
        select.append(opt);
      });
      select.value = String(pageSize);
      select.addEventListener('change', () => {
        state.pageSizes[listKey] = Number(select.value);
        state.pages[listKey] = 1;
        try {
          localStorage.setItem(STORAGE_PAGE_SIZES_KEY, JSON.stringify(state.pageSizes));
        } catch {}
        onRender();
      });
      perPageLabel.append(select);

      const rangeText = document.createElement('span');
      rangeText.className = 'muted';
      rangeText.textContent = (startIdx + 1) + '–' + endIdx + ' of ' + totalItems;
      info.append(perPageLabel, rangeText);

      const controls = document.createElement('div');
      controls.className = 'pagination-controls';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'secondary small-btn';
      prevBtn.textContent = '‹ Prev';
      prevBtn.disabled = currentPage <= 1;
      prevBtn.addEventListener('click', () => {
        if (state.pages[listKey] > 1) {
          state.pages[listKey]--;
          onRender();
        }
      });

      const pageIndicator = document.createElement('span');
      pageIndicator.className = 'pagination-page-label';
      pageIndicator.textContent = currentPage + ' / ' + totalPages;

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'secondary small-btn';
      nextBtn.textContent = 'Next ›';
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.addEventListener('click', () => {
        if (state.pages[listKey] < totalPages) {
          state.pages[listKey]++;
          onRender();
        }
      });

      controls.append(prevBtn, pageIndicator, nextBtn);
      bar.append(info, controls);

      return {
        slice: (items) => items.slice(startIdx, endIdx)
      };
    }

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
        button.className = 'small-btn';
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
          state.pages.pending = 1;
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
          state.pages.ads = 1;
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
      editBtn.textContent = 'Edit';
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
      const containerId = pending ? 'pending-stories' : banned ? 'banned-stories' : 'stories';
      const paginationId = pending ? 'pending-pagination' : banned ? 'banned-pagination' : 'decided-pagination';
      const listKey = pending ? 'pending' : banned ? 'banned' : 'decided';
      const container = document.getElementById(containerId);
      container.replaceChildren();
      const visibleStories = pending
        ? stories.filter((story) =>
          !state.ignored.has(story.id) &&
          (state.activeCategory === 'all' || story.category === state.activeCategory) &&
          (state.activeProvider === 'all' || story.provider === state.activeProvider))
        : stories;

      const pager = renderPaginationBar(paginationId, listKey, visibleStories.length, () => {
        renderStories(stories, { pending, decided, banned });
        refreshStoryAges();
      });

      const pagedStories = pager.slice(visibleStories);
      pagedStories.forEach((story) => {
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

    /* STORY SEARCH WITH PAGINATION */
    function renderStorySearchMatches(matched, q) {
      storySearchResultsEl.replaceChildren();
      storySearchCountEl.style.display = 'block';
      storySearchCountEl.textContent = 'Found ' + matched.length + ' matching stories for "' + q + '":';

      const pager = renderPaginationBar('search-pagination', 'search', matched.length, () => {
        renderStorySearchMatches(matched, q);
        refreshStoryAges();
      });

      if (!matched.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No matching stories found.';
        storySearchResultsEl.append(empty);
        return;
      }

      pager.slice(matched).forEach((story) => {
        storySearchResultsEl.append(createStoryCardRow(story, { isSearch: true }));
      });
      refreshStoryAges();
    }

    function performStorySearch() {
      const q = state.storySearchQuery.toLowerCase().trim();
      if (!q) {
        storySearchResultsEl.replaceChildren();
        storySearchCountEl.style.display = 'none';
        clearStorySearchBtn.style.display = 'none';
        document.getElementById('search-pagination').hidden = true;
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

      renderStorySearchMatches(matched, q);

      if (q.length >= 2) {
        request('/admin/api/stories/search?q=' + encodeURIComponent(q))
          .then((data) => {
            if (data.items && data.items.length) {
              let added = false;
              data.items.forEach((item) => {
                const key = item.id || item.link;
                if (!seen.has(key)) {
                  seen.add(key);
                  matched.push(item);
                  state.searchResults.push(item);
                  added = true;
                }
              });
              if (added && state.storySearchQuery.toLowerCase().trim() === q) {
                renderStorySearchMatches(matched, q);
              }
            }
          })
          .catch(() => {});
      }
    }

    storySearchInput.addEventListener('input', () => {
      state.storySearchQuery = storySearchInput.value;
      state.pages.search = 1;
      clearTimeout(state.storySearchTimer);
      state.storySearchTimer = setTimeout(performStorySearch, 250);
    });

    clearStorySearchBtn.addEventListener('click', () => {
      storySearchInput.value = '';
      state.storySearchQuery = '';
      state.pages.search = 1;
      performStorySearch();
    });

    /* ADS MANAGEMENT, SEARCH & PAGINATION */
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
      const filtered = state.ads.filter((ad) => {
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
      document.getElementById('ads-results-count').textContent = 'Matching ads: ' + filtered.length + ' of ' + state.ads.length;
      adsListEl.replaceChildren();

      const pager = renderPaginationBar('ads-pagination', 'ads', filtered.length, filterAndRenderAds);

      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No ads match the current filters.';
        adsListEl.append(empty);
        return;
      }

      pager.slice(filtered).forEach((ad) => {
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
        sponsor.textContent = ad.sponsor || 'Featured Partner';

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
        editBtn.textContent = 'Edit';
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
      state.pages.ads = 1;
      filterAndRenderAds();
    });

    adsNetworkFilterEl.addEventListener('change', () => {
      state.activeAdNetwork = adsNetworkFilterEl.value;
      state.pages.ads = 1;
      filterAndRenderAds();
    });

    document.getElementById('create-ad-btn').addEventListener('click', () => {
      openAdPreview(null);
    });

    async function refreshData() {
      state.pages.pending = 1;
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

    function editButton(label, className = '') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preview-edit ' + className;
      button.textContent = '✏️';
      button.title = 'Edit ' + label;
      button.setAttribute('aria-label', 'Edit ' + label);
      return button;
    }

    /* Commit any open inline editors before saving the card */
    function commitAllOpenEditors() {
      document.querySelectorAll('#preview-card .preview-inline-editor').forEach((editorEl) => {
        if (typeof editorEl._commit === 'function') editorEl._commit();
      });
    }

    /* EDITABLE FIELD: Isolated per-field commit & cancel so canceling one field never closes other open fields */
    function editableField(parent, field, label, {
      tag = 'span',
      value = '',
      editor = 'text',
      className = '',
      display = val => val || 'Not set',
      onSave = null
    } = {}) {
      const currentDraft = state.previewType === 'ad' ? state.previewAdDraft : state.previewDraft;
      let currentValue = value !== '' ? value : (currentDraft?.[field] || '');
      const wrapper = document.createElement('span');
      wrapper.className = 'preview-editable ' + className;
      const visible = document.createElement(tag);
      visible.className = 'preview-value';
      if (field === 'title') {
        visible.classList.add(state.previewType === 'ad' ? 'ad-card-title' : 'news-card-title');
      }

      const updateVisibleDom = (val) => {
        visible.replaceChildren();
        const displayValue = display(val);
        if (displayValue instanceof Node) visible.append(displayValue);
        else visible.textContent = decodeHtmlEntities(displayValue);
        if (tag === 'a') {
          visible.href = currentDraft.link || currentDraft.url || '#';
          visible.target = '_blank';
          visible.rel = 'noopener noreferrer';
        }
      };
      updateVisibleDom(currentValue);

      const pencil = editButton(label);
      pencil.addEventListener('click', (event) => {
        event.stopPropagation();
        if (wrapper.classList.contains('is-editing')) return;
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
          input.value = currentValue || 'all';
        } else if (editor === 'network') {
          input = document.createElement('select');
          ['Amazon', 'TikTok', 'Gumroad', 'Partner'].forEach((net) => {
            const option = document.createElement('option');
            option.value = net;
            option.textContent = net;
            input.append(option);
          });
          input.value = currentValue || 'Partner';
        } else if (editor === 'textarea') {
          input = document.createElement('textarea');
          input.value = currentValue;
          input.rows = 4;
        } else {
          input = document.createElement('input');
          input.type = editor;
          input.value = editor === 'datetime-local' && currentValue
            ? (() => {
              const date = new Date(currentValue);
              date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
              return date.toISOString().slice(0, 16);
            })()
            : currentValue;
        }
        input.setAttribute('aria-label', label);
        input.placeholder = 'Enter ' + label + '…';

        const closeInlineEditor = () => {
          editorWrap.remove();
          wrapper.classList.remove('is-editing');
          visible.style.display = '';
          pencil.style.display = '';
        };

        const commitValue = () => {
          let next = input.value.trim();
          if (editor === 'datetime-local' && next) next = new Date(next).toISOString();
          currentValue = next;
          currentDraft[field] = next;
          if (onSave) onSave(next);
          updateVisibleDom(next);

          // Update live card elements in-place without destroying other open field editors
          const cardEl = wrapper.closest('.news-card');
          if (cardEl) {
            if (field === 'image') {
              const imgEl = cardEl.querySelector('.news-card-image');
              if (imgEl) imgEl.src = next || 'img/' + (currentDraft.category || 'all') + '_1.jpg';
            } else if (field === 'link' || field === 'url') {
              cardEl.querySelectorAll('a').forEach((aEl) => {
                aEl.href = next || '#';
              });
            }
          }
          closeInlineEditor();
        };

        const cancelValue = () => {
          closeInlineEditor();
        };

        editorWrap._commit = commitValue;

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && editor !== 'textarea') {
            e.preventDefault();
            commitValue();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && editor === 'textarea') {
            e.preventDefault();
            commitValue();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelValue();
          }
        });

        const btnRow = document.createElement('div');
        btnRow.className = 'editor-btn-row';

        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'small-btn';
        done.textContent = 'OK';
        done.addEventListener('click', commitValue);

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary small-btn';
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

      editableField(imageWrap, 'category', 'category', {
        className: 'preview-category-edit',
        editor: 'category',
        display: (val) => {
          const catObj = categories.find(item => item.id === (val || draft.category)) || categories[0];
          const badge = document.createElement('span');
          badge.className = 'news-card-badge';
          badge.textContent = catObj.icon + ' ' + catObj.label;
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
      editableField(date, 'pubDate', 'publication date', {
        display: (val) => {
          const d = val ? new Date(val) : (draft.pubDate ? new Date(draft.pubDate) : new Date());
          return '🕒 ' + d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        },
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
        editableField(aiSummary, 'aiSummary', 'AI summary', {
          editor: 'textarea',
          display: value => value
        });
        content.append(aiSummary);
      }

      const generateSummary = document.createElement('button');
      generateSummary.type = 'button';
      generateSummary.className = 'summary-generate';
      generateSummary.textContent = state.generatingSummary ? 'Generating…' : 'Generate AI summary';
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
        display: () => 'Link'
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
      close.id = 'preview-close';
      close.type = 'button';
      close.className = 'secondary small-btn';
      close.textContent = 'Close';
      close.addEventListener('click', () => previewDialog.close());
      actions.append(close);

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'small-btn';
      save.textContent = state.previewStoryId === null ? 'Add to approved stories' : 'Save';
      save.addEventListener('click', () => savePreview(false));
      actions.append(save);

      if (state.previewStoryId !== null && draft.approved !== true && draft.removed !== true) {
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.className = 'small-btn';
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

      editableField(imageWrap, 'category', 'category', {
        className: 'preview-category-edit',
        editor: 'category',
        value: draft.category,
        display: (val) => {
          const catObj = categories.find(item => item.id === (val || draft.category)) || categories[0];
          const catSpan = document.createElement('span');
          catSpan.className = 'news-card-badge';
          catSpan.style.background = '#0f172a';
          catSpan.textContent = catObj.icon + ' ' + catObj.label;
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
        display: () => 'Link URL',
        onSave: (val) => { draft.url = val; }
      });
      content.append(footer);

      card.append(imageWrap, content);
      preview.append(card);

      const actions = document.createElement('div');
      actions.className = 'preview-actions';
      const close = document.createElement('button');
      close.id = 'preview-close';
      close.type = 'button';
      close.className = 'secondary small-btn';
      close.textContent = 'Close';
      close.addEventListener('click', () => previewDialog.close());
      actions.append(close);

      const save = document.createElement('button');
      save.type = 'button';
      save.className = 'small-btn';
      save.textContent = state.previewAdId ? 'Save' : 'Create';
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
      lockModalScroll();
      if (!previewDialog.open) previewDialog.showModal();
      previewDialog.scrollTop = 0;
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
      lockModalScroll();
      if (!previewDialog.open) previewDialog.showModal();
      previewDialog.scrollTop = 0;
    }

    async function savePreview(approve) {
      commitAllOpenEditors();
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
        previewDialog.close();
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
      commitAllOpenEditors();
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
        previewDialog.close();
        filterAndRenderAds();
        messageEl.className = 'success';
        messageEl.textContent = existingId ? 'Ad changes saved.' : 'New ad created and saved.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not save ad: ' + error.message;
      }
    }

    async function generatePreviewSummary() {
      commitAllOpenEditors();
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

    restoreSectionLayout();
    refreshData();
    setInterval(refreshStoryAges, 1000);
    setInterval(() => {
      if (state.providers.some((provider) => provider.status === 'running')) refreshData();
    }, 15000);
  </script>
</body>
</html>`;
}
