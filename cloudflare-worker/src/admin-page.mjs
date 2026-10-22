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
    .awin-panel {
      border: 1px solid #334155;
      border-radius: .6rem;
      padding: .7rem .9rem;
      margin-bottom: .8rem;
      background: #1e293b;
    }
    .awin-panel-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .8rem;
      flex-wrap: wrap;
    }
    .awin-log {
      margin-top: .6rem;
      font-size: .8rem;
      line-height: 1.5;
      max-height: 12rem;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .awin-log .ok { color: #15803d; }
    .awin-log .warn { color: #b45309; }
    .awin-log .err { color: #dc2626; }
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
    @keyframes adminImageShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .story, .ad-row {
      display: grid;
      align-items: center;
      gap: .75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
    }
    .story { grid-template-columns: 80px minmax(0, 1fr) auto; }
    .story.ai-pick-row { grid-template-columns: auto 80px minmax(0, 1fr) auto; }
    .ad-row { grid-template-columns: auto 80px minmax(0, 1fr) auto; }
    .ad-select {
      width: 18px;
      height: 18px;
      accent-color: #4f46e5;
      cursor: pointer;
      margin: 0;
    }
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
      width: 80px;
      height: auto;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 6px;
      background: linear-gradient(110deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: adminImageShimmer 1.6s ease-in-out infinite;
      display: block;
      transition: opacity 0.25s ease;
    }
    .story img.is-loaded, .ad-row img.is-loaded {
      animation: none;
      background: #1e293b;
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
      height: auto;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: linear-gradient(110deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: adminImageShimmer 1.6s ease-in-out infinite;
    }
    .news-card-image-wrap.is-loaded {
      animation: none;
      background: #1e293b;
    }
    .news-card-image {
      display: block;
      width: 100%;
      height: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      opacity: 0;
      transition: opacity 0.28s ease;
    }
    .news-card-image-wrap.is-loaded .news-card-image,
    .news-card-image.is-loaded {
      opacity: 1;
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
    .preview-ai-actions {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex-wrap: wrap;
    }
    .summary-generate {
      padding: .4rem .7rem;
      background: #3730a3;
      font-size: .8rem;
      border-radius: 6px;
      align-self: flex-start;
    }
    .summary-generate:hover:not(:disabled) { background: #4338ca; }
    .image-generate {
      background: #0f766e;
    }
    .image-generate:hover:not(:disabled) {
      background: #0d9488;
    }
    .preview-image-loading {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgba(11, 15, 25, 0.72);
      color: #f8fafc;
      font-size: .82rem;
      font-weight: 700;
      z-index: 5;
      text-align: center;
      padding: 1rem;
    }
    .preview-status-msg {
      margin: .65rem 0 0;
      font-size: .8rem;
    }

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
    .status-rate_limited { color: #fbbf24; }
    .status-skipped_cooldown { color: #fbbf24; }
    .status-failed { color: #fca5a5; }
    .status-running { color: #7dd3fc; }
    .status-never { color: #cbd5e1; }
    .error { color: #fca5a5 !important; }
    .success { color: #86efac !important; }
    .tabular-nums { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    /* Auto-Sync Control Bar & Provider Cooldown Banner */
    .auto-sync-bar {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: .75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: .75rem .9rem;
      margin-bottom: .25rem;
    }
    .auto-sync-info {
      display: flex;
      flex-direction: column;
      gap: .2rem;
    }
    .auto-sync-title {
      font-size: .88rem;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
    }
    .auto-sync-meta {
      font-size: .76rem;
      color: #94a3b8;
    }
    .auto-sync-actions {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex-wrap: wrap;
    }
    .cooldown-callout {
      margin-top: .45rem;
      padding: .5rem .65rem;
      background: rgba(217, 119, 6, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 8px;
      color: #fde68a;
      font-size: .76rem;
      line-height: 1.4;
    }

    /* Provider Fetch & Rate-Limit Log Viewer */
    .log-summary-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: .6rem;
      margin-bottom: .75rem;
    }
    .log-stat-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: .55rem .7rem;
    }
    .log-stat-label {
      font-size: .72rem;
      color: #94a3b8;
      margin: 0 0 .15rem;
    }
    .log-stat-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
    }
    .log-list {
      display: grid;
      gap: .45rem;
    }
    .log-row {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: .55rem .75rem;
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .log-row:hover {
      border-color: #6366f1;
      background: #162033;
    }
    .log-row-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .65rem;
      flex-wrap: wrap;
      font-size: .8rem;
    }
    .log-row-left {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex-wrap: wrap;
      min-width: 0;
    }
    .log-row-right {
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
      font-size: .75rem;
      color: #cbd5e1;
    }
    .log-error-line {
      margin: .3rem 0 0;
      font-size: .76rem;
      color: #fca5a5;
      overflow-wrap: anywhere;
    }
    .log-drawer {
      margin-top: .5rem;
      padding-top: .5rem;
      border-top: 1px solid #334155;
      font-size: .75rem;
      color: #cbd5e1;
      display: grid;
      gap: .25rem;
      overflow-wrap: anywhere;
    }

    /* AI Daily Story Curation & Staging Queue */
    #ai-staged-stories {
      display: grid;
      gap: .6rem;
    }
    .ai-curation-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: .75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: .75rem .9rem;
      margin-bottom: .65rem;
    }
    .ai-curation-info {
      display: flex;
      flex-direction: column;
      gap: .22rem;
      min-width: 240px;
      flex: 1;
    }
    .ai-curation-title {
      font-size: .9rem;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-wrap: wrap;
    }
    .ai-curation-meta {
      font-size: .76rem;
      color: #94a3b8;
      line-height: 1.4;
    }
    .ai-curation-actions {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex-wrap: wrap;
    }
    .ai-taste-drawer {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: .85rem .95rem;
      margin-bottom: .75rem;
      display: grid;
      gap: .75rem;
    }
    .ai-taste-drawer[hidden] { display: none !important; }
    .ai-signal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: .55rem;
    }
    .ai-signal-box {
      background: #131b2e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: .55rem .7rem;
      font-size: .76rem;
      color: #cbd5e1;
      line-height: 1.4;
    }
    .ai-signal-box strong {
      display: block;
      font-size: .72rem;
      color: #94a3b8;
      margin-bottom: .2rem;
      font-weight: 600;
    }
    .ai-taste-field {
      display: flex;
      flex-direction: column;
      gap: .3rem;
      font-size: .8rem;
      color: #cbd5e1;
    }
    .ai-taste-field label {
      font-weight: 600;
      color: #f8fafc;
    }
    .ai-taste-field textarea,
    .ai-taste-field input {
      width: 100%;
      padding: .55rem .7rem;
      border: 1px solid #334155;
      border-radius: 8px;
      background: #0b0f19;
      color: #f8fafc;
      font: inherit;
      font-size: .84rem;
      line-height: 1.45;
    }
    .ai-taste-field textarea:focus,
    .ai-taste-field input:focus {
      outline: none;
      border-color: #6366f1;
    }
    .ai-taste-two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: .65rem;
    }
    .ai-bulk-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: .55rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: .5rem .75rem;
      margin-bottom: .65rem;
      font-size: .8rem;
    }
    .ai-bulk-left, .ai-bulk-right {
      display: flex;
      align-items: center;
      gap: .45rem;
      flex-wrap: wrap;
    }
    .story.ai-pick-row {
      grid-template-columns: auto 80px minmax(0, 1fr) auto;
    }
    .ai-pick-checkbox {
      width: 18px;
      height: 18px;
      accent-color: #4f46e5;
      cursor: pointer;
      margin: 0;
    }
    .ai-pick-reason {
      margin: .28rem 0 0;
      font-size: .77rem;
      color: #a5b4fc;
      line-height: 1.4;
    }
    .meta-slot { color: #38bdf8; }
    .meta-rank { color: #f472b6; font-variant-numeric: tabular-nums; }
    .btn-approve-accent { background: #059669; }
    .btn-approve-accent:hover:not(:disabled) { background: #047857; }
    .btn-danger-outline {
      background: rgba(239, 68, 68, 0.14);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .btn-danger-outline:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.26);
    }

    @media (max-width: 640px) {
      body { padding: .85rem .65rem 2.5rem; }
      h1 { font-size: 1.2rem; }
      .admin-card-section, .summary { padding: .7rem .75rem; }
      .story, .ad-row {
        grid-template-columns: 64px minmax(0, 1fr);
        gap: .55rem;
        padding: .55rem;
      }
      .story.ai-pick-row, .ad-row {
        grid-template-columns: auto 64px minmax(0, 1fr);
      }
      .story img, .ad-row img { width: 64px; height: auto; aspect-ratio: 16 / 9; }
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

    <!-- 1B. AI CURATED STAGING QUEUE SECTION (5 Stories/Category · 3x/Day) -->
    <section aria-labelledby="ai-staging-title" class="admin-card-section" data-section-id="ai-staging">
      <div class="section-header">
        <h2 id="ai-staging-title">
          <button id="ai-staging-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="ai-staging-body" data-section-toggle="ai-staging">
            <span id="ai-staging-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>AI Picked for You · Staging Queue <span id="ai-staging-count" class="tabular-nums"></span></span>
          </button>
        </h2>
        <div class="section-controls">
          <button id="toggle-taste-drawer-btn" type="button" class="secondary small-btn" aria-expanded="false" aria-controls="ai-taste-drawer">Taste Profile &amp; Schedule</button>
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="ai-staging-body" class="section-body">
        <div id="ai-curation-bar" class="ai-curation-bar"></div>
        <div id="ai-taste-drawer" class="ai-taste-drawer" hidden></div>
        <div class="filter-bar" style="justify-content: space-between;">
          <nav id="ai-edition-tabs" class="category-tabs" aria-label="Filter AI picks by daily edition" style="margin: 0;"></nav>
        </div>
        <nav id="ai-staging-categories" class="category-tabs" aria-label="Filter AI staged stories by category"></nav>
        <div id="ai-bulk-bar" class="ai-bulk-bar"></div>
        <div id="ai-staged-stories" aria-live="polite"></div>
        <div id="ai-staging-pagination" class="pagination-bar"></div>
      </div>
    </section>

    <!-- 1b. EMBEDDING VALIDATION SECTION -->
    <section aria-labelledby="embedding-validation-title" class="admin-card-section" data-section-id="embedding-validation">
      <div class="section-header">
        <h2 id="embedding-validation-title">
          <button id="embedding-validation-toggle" class="section-toggle" type="button" aria-expanded="true" aria-controls="embedding-validation-body" data-section-toggle="embedding-validation">
            <span id="embedding-validation-arrow" class="section-arrow" aria-hidden="true">▲</span>
            <span>Embedding Category Validation <span id="embedding-validation-count"></span></span>
          </button>
        </h2>
      </div>
      <div id="embedding-validation-body" class="section-body">
        <p class="admin-hint">Validates story categories using semantic embeddings. Flags stories where the AI-predicted category disagrees with the query-assigned category.</p>
        <div style="display: flex; gap: 0.75rem; align-items: center; margin: 1rem 0; flex-wrap: wrap;">
          <label for="validate-categories-limit" class="admin-hint" style="margin: 0;">Stories to validate:</label>
          <input id="validate-categories-limit" type="number" min="1" max="20" value="15" style="width: 5rem; padding: 0.5rem; border-radius: 0.4rem; border: 1px solid var(--news-border, #334155); background: var(--news-card-bg, #1e293b); color: var(--news-text, #f1f5f9);" />
          <button id="validate-categories-btn" class="sign-in-button primary-button" type="button" style="width: auto; padding: 0.6rem 1.2rem;">
            Validate Categories
          </button>
          <span id="validate-categories-status" class="admin-hint"></span>
        </div>
        <div id="validate-categories-results" aria-live="polite"></div>
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
        <div id="awin-panel" class="awin-panel">
          <div class="awin-panel-row">
            <div>
              <strong>Awin affiliate sync</strong>
              <span id="awin-status-line" class="muted"></span>
            </div>
            <button id="awin-sync-btn" type="button" class="small-btn">⟳ Update Awin data</button>
          </div>
          <div id="awin-sync-log" class="awin-log" hidden></div>
        </div>
        <div class="filter-bar">
          <input id="ad-search-input" class="custom-input" type="search" placeholder="Search ads by title, sponsor, network, CTA..." aria-label="Search ads" style="flex: 1; min-width: 200px;">
          <label class="provider-toolbar" for="ads-network-filter">
            Network
            <select id="ads-network-filter" class="provider-filter">
              <option value="all">All</option>
              <option value="Amazon">Amazon</option>
              <option value="TikTok">TikTok</option>
              <option value="Gumroad">Gumroad</option>
              <option value="Awin">Awin</option>
              <option value="Partner">Partner</option>
            </select>
          </label>
          <label class="provider-toolbar" for="ads-program-filter" id="ads-program-filter-wrap" hidden>
            Program
            <select id="ads-program-filter" class="provider-filter">
              <option value="all">All programs</option>
            </select>
          </label>
          <label class="provider-toolbar" for="ads-quality-filter">
            Show
            <select id="ads-quality-filter" class="provider-filter">
              <option value="all">All ads</option>
              <option value="needs-category">Needs category</option>
              <option value="no-image">Missing image</option>
              <option value="products">Products only</option>
              <option value="programs">Brand cards only</option>
              <option value="hidden">Hidden only</option>
              <option value="visible">Visible only</option>
            </select>
          </label>
        </div>
        <div id="ads-bulk-bar" class="awin-panel" hidden style="display: flex; gap: .6rem; align-items: center; margin-bottom: .6rem; flex-wrap: wrap;">
          <span id="ads-bulk-count" class="muted"></span>
          <label class="provider-toolbar" for="ads-bulk-category">
            Set category
            <select id="ads-bulk-category" class="provider-filter"></select>
          </label>
          <button id="ads-bulk-apply" type="button" class="small-btn">Apply</button>
          <button id="ads-bulk-hide" type="button" class="secondary small-btn">Hide</button>
          <button id="ads-bulk-show" type="button" class="secondary small-btn">Show</button>
          <button id="ads-bulk-clear" type="button" class="secondary small-btn">Clear</button>
        </div>
        <div style="margin-bottom: .6rem;">
          <button id="ads-select-all" type="button" class="secondary small-btn">Select all on page</button>
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

    <!-- 6B. PROVIDER FETCH & RATE-LIMIT LOGS SECTION -->
    <section aria-labelledby="logs-title" class="admin-card-section" data-section-id="logs">
      <div class="section-header">
        <h2 id="logs-title">
          <button id="logs-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="logs-body" data-section-toggle="logs">
            <span id="logs-arrow" class="section-arrow" aria-hidden="true">▼</span>
            <span>Provider Fetch &amp; Rate-Limit Logs <span id="logs-count"></span></span>
          </button>
        </h2>
        <div class="section-controls">
          <button id="refresh-logs-btn" type="button" class="secondary small-btn">Refresh logs</button>
          <button id="clear-logs-btn" type="button" class="secondary small-btn">Clear logs</button>
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="logs-body" class="section-body" hidden>
        <div id="logs-summary" class="log-summary-strip"></div>
        <div class="filter-bar">
          <nav id="logs-status-tabs" class="category-tabs" aria-label="Filter fetch logs by status" style="margin: 0;"></nav>
          <label class="provider-toolbar" for="logs-provider-filter">
            Provider
            <select id="logs-provider-filter" class="provider-filter">
              <option value="all">All providers</option>
            </select>
          </label>
          <label class="provider-toolbar" for="logs-category-filter">
            Topic
            <select id="logs-category-filter" class="provider-filter">
              <option value="all">All topics</option>
            </select>
          </label>
        </div>
        <div id="provider-logs-list" class="log-list" aria-live="polite"></div>
        <div id="logs-pagination" class="pagination-bar"></div>
      </div>
    </section>

    <!-- 7. HISTORY SECTION -->
    <section aria-labelledby="stories-title" class="admin-card-section" data-section-id="decisions">
      <div class="section-header">
        <h2 id="stories-title">
          <button id="decisions-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="stories" data-section-toggle="decisions">
            <span id="decisions-arrow" class="section-arrow" aria-hidden="true">▼</span>
            <span>History <span id="history-count"></span></span>
          </button>
        </h2>
        <div class="section-controls">
          <button type="button" class="icon-btn move-up-btn" aria-label="Move section up" title="Move up">↑</button>
          <button type="button" class="icon-btn move-down-btn" aria-label="Move section down" title="Move down">↓</button>
        </div>
      </div>
      <div id="decisions-body" class="section-body" hidden>
        <nav id="history-categories" class="category-tabs" aria-label="Filter history stories by category"></nav>
        <div class="filter-bar">
          <label class="provider-toolbar" for="history-provider">
            Provider
            <select id="history-provider" class="provider-filter">
              <option value="all">All providers</option>
            </select>
          </label>
        </div>
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
            <span>Banned stories <span id="banned-count"></span></span>
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
          aiStaging: PAGE_SIZE_OPTIONS.includes(Number(saved.aiStaging)) ? Number(saved.aiStaging) : 10,
          pending: PAGE_SIZE_OPTIONS.includes(Number(saved.pending)) ? Number(saved.pending) : 10,
          search: PAGE_SIZE_OPTIONS.includes(Number(saved.search)) ? Number(saved.search) : 10,
          ads: PAGE_SIZE_OPTIONS.includes(Number(saved.ads)) ? Number(saved.ads) : 10,
          decided: PAGE_SIZE_OPTIONS.includes(Number(saved.decided)) ? Number(saved.decided) : 10,
          banned: PAGE_SIZE_OPTIONS.includes(Number(saved.banned)) ? Number(saved.banned) : 10,
          logs: PAGE_SIZE_OPTIONS.includes(Number(saved.logs)) ? Number(saved.logs) : 20
        };
      } catch {
        return { aiStaging: 10, pending: 10, search: 10, ads: 10, decided: 10, banned: 10, logs: 20 };
      }
    }

    const state = {
      busy: new Set(),
      syncingAll: false,
      togglingAutoSync: false,
      curatingAi: false,
      togglingAiSchedule: false,
      savingTasteProfile: false,
      bulkDecidingAi: false,
      tasteDrawerOpen: false,
      selectedAiStoryIds: new Set(),
      activeAiCategory: 'all_categories',
      activeAiSlot: 'all',
      selectedRunSlot: 'auto',
      approving: new Set(),
      banning: new Set(),
      unapproving: new Set(),
      undoing: new Set(),
      ignored: new Set(),
      expandedLogs: new Set(),
      previewTimer: null,
      previewType: 'story',
      previewDraft: null,
      previewStoryId: null,
      previewAdDraft: null,
      previewAdId: null,
      generatingSummary: false,
      generatingImage: false,
      previewStatusMessage: '',
      previewStatusType: 'muted',
      activeCategory: 'all',
      activeProvider: 'all',
      activeHistoryCategory: 'all',
      activeHistoryProvider: 'all',
      activeAdCategory: 'all',
      activeAdNetwork: 'all',
      activeAdProgram: 'all',
      activeAdQuality: 'all',
      selectedAdIds: new Set(),
      activeLogStatus: 'all',
      activeLogProvider: 'all',
      activeLogCategory: 'all',
      adSearchQuery: '',
      storySearchQuery: '',
      storySearchTimer: null,
      providers: [],
      autoSync: {
        enabled: true,
        intervalMs: 3600000,
        lastRunAt: null,
        nextRunAt: null,
        lastTrigger: null,
        lastStatus: 'never',
        lastSummary: null,
        isStale: false
      },
      aiCuration: {
        enabled: true,
        picksPerCategory: 5,
        currentSlot: 'morning',
        currentSlotLabel: 'Morning Edition (08:00)',
        isSlotDue: false,
        lastRunAt: null,
        lastSlot: null,
        lastBatchId: null,
        lastTrigger: null,
        lastStatus: 'never',
        lastSummary: null,
        nextSlot: 'morning',
        nextRunAt: null,
        completedSlotsToday: [],
        tasteProfile: {
          customInstructions: '',
          preferredKeywords: '',
          mutedKeywords: ''
        },
        learnedSignals: {
          approvedCount: 0,
          rejectedCount: 0,
          topApprovedSources: [],
          topApprovedCategories: [],
          topApprovedTerms: [],
          avoidedSources: [],
          avoidedTerms: []
        },
        stagedPicks: [],
        categoryCounts: {}
      },
      providerLogs: [],
      providerLogsSummary: {
        totalRequests: 0,
        rateLimitedCount: 0,
        failedCount: 0,
        failoverCount: 0,
        averageLatencyMs: 0
      },
      pendingStories: [],
      decidedStories: [],
      bannedStories: [],
      searchResults: [],
      ads: [],
      pages: {
        aiStaging: 1,
        pending: 1,
        search: 1,
        ads: 1,
        decided: 1,
        banned: 1,
        logs: 1
      },
      pageSizes: loadSavedPageSizes()
    };

    const adminSectionsEl = document.getElementById('admin-sections');
    const providersEl = document.getElementById('providers');
    const messageEl = document.getElementById('message');
    const categoryEl = document.getElementById('approval-categories');
    const providerFilterEl = document.getElementById('approval-provider');
    const historyCategoryEl = document.getElementById('history-categories');
    const historyProviderFilterEl = document.getElementById('history-provider');
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
      'ai-staging': { toggle: 'ai-staging-toggle', arrow: 'ai-staging-arrow', body: 'ai-staging-body', defaultOpen: true },
      'embedding-validation': { toggle: 'embedding-validation-toggle', arrow: 'embedding-validation-arrow', body: 'embedding-validation-body', defaultOpen: true },
      pending: { toggle: 'pending-toggle', arrow: 'pending-arrow', body: 'pending-body', defaultOpen: true },
      search: { toggle: 'search-toggle', arrow: 'search-arrow', body: 'search-body', defaultOpen: true },
      ads: { toggle: 'ads-toggle', arrow: 'ads-arrow', body: 'ads-section', defaultOpen: true },
      custom: { toggle: 'custom-toggle', arrow: 'custom-arrow', body: 'custom-body', defaultOpen: true },
      providers: { toggle: 'providers-toggle', arrow: 'providers-arrow', body: 'providers', defaultOpen: false },
      logs: { toggle: 'logs-toggle', arrow: 'logs-arrow', body: 'logs-body', defaultOpen: false },
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
      ['summary', 'ai-staging', 'pending', 'search', 'ads', 'custom', 'providers', 'logs', 'decisions', 'banned'].forEach((id) => {
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

    function formatCountdown(targetIso) {
      const targetMs = Date.parse(targetIso || '');
      if (!Number.isFinite(targetMs)) return 'Ready now';
      const remainingSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      if (remainingSec <= 0) return 'Due now';
      const hrs = Math.floor(remainingSec / 3600);
      const mins = String(Math.floor((remainingSec % 3600) / 60)).padStart(2, '0');
      const secs = String(remainingSec % 60).padStart(2, '0');
      return (hrs > 0 ? hrs + 'h ' : '') + mins + 'm ' + secs + 's';
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
      document.querySelectorAll('[data-countdown-to]').forEach((element) => {
        element.textContent = (element.dataset.countdownPrefix || '') + formatCountdown(element.dataset.countdownTo);
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

      const autoBar = document.createElement('div');
      autoBar.className = 'auto-sync-bar';
      const autoInfo = document.createElement('div');
      autoInfo.className = 'auto-sync-info';
      const autoTitle = document.createElement('div');
      autoTitle.className = 'auto-sync-title';
      autoTitle.textContent = 'Hourly Auto-Querying: ';
      const autoBadge = document.createElement('span');
      autoBadge.className = 'status ' + (state.autoSync?.enabled ? 'status-succeeded' : 'status-partial');
      autoBadge.textContent = state.autoSync?.enabled ? 'Active · Every 1 hour' : 'Paused';
      autoTitle.append(autoBadge);

      const autoMeta = document.createElement('div');
      autoMeta.className = 'auto-sync-meta tabular-nums';
      const lastRunStr = state.autoSync?.lastRunAt
        ? formatDateTime(new Date(state.autoSync.lastRunAt)) + ' (' + (state.autoSync.lastTrigger || 'auto') + ')'
        : 'Never';
      autoMeta.textContent = 'Cron: 0 * * * * · Last cycle: ' + lastRunStr + ' · ';
      if (state.autoSync?.enabled) {
        const nextSpan = document.createElement('span');
        nextSpan.dataset.countdownPrefix = 'Next cycle in ';
        nextSpan.dataset.countdownTo = state.autoSync.nextRunAt || '';
        nextSpan.textContent = 'Next cycle in ' + formatCountdown(state.autoSync.nextRunAt);
        autoMeta.append(nextSpan);
      } else {
        autoMeta.append('Auto-sync paused');
      }
      if (state.autoSync?.lastSummary) {
        const sumLine = document.createElement('div');
        sumLine.className = 'auto-sync-meta';
        sumLine.textContent = state.autoSync.lastSummary;
        autoInfo.append(autoTitle, autoMeta, sumLine);
      } else {
        autoInfo.append(autoTitle, autoMeta);
      }

      const autoActions = document.createElement('div');
      autoActions.className = 'auto-sync-actions';
      const toggleAutoBtn = document.createElement('button');
      toggleAutoBtn.id = 'toggle-auto-sync';
      toggleAutoBtn.type = 'button';
      toggleAutoBtn.className = 'secondary small-btn';
      toggleAutoBtn.disabled = state.togglingAutoSync;
      toggleAutoBtn.textContent = state.autoSync?.enabled ? 'Pause hourly sync' : 'Enable hourly sync';
      toggleAutoBtn.addEventListener('click', toggleHourlyAutoSync);

      const syncAllBtn = document.createElement('button');
      syncAllBtn.id = 'sync-all-providers';
      syncAllBtn.type = 'button';
      syncAllBtn.className = 'small-btn';
      syncAllBtn.disabled = state.syncingAll;
      syncAllBtn.textContent = state.syncingAll ? 'Syncing all…' : 'Sync all providers now';
      syncAllBtn.addEventListener('click', syncAllProvidersNow);

      autoActions.append(toggleAutoBtn, syncAllBtn);
      autoBar.append(autoInfo, autoActions);
      providersEl.append(autoBar);

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
        if (provider.status === 'running') {
          const resetButton = document.createElement('button');
          resetButton.type = 'button';
          resetButton.className = 'small-btn';
          resetButton.textContent = 'Reset stuck run';
          resetButton.disabled = state.busy.has(provider.id);
          resetButton.addEventListener('click', () => resetProviderSync(provider.id));
          head.append(resetButton);
        }
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

        if (provider.cooldown_until && Date.parse(provider.cooldown_until) > Date.now()) {
          const cooldownBox = document.createElement('div');
          cooldownBox.className = 'cooldown-callout tabular-nums';
          const timerLine = document.createElement('div');
          timerLine.dataset.countdownPrefix = 'Rate-limit cooldown active · Resets in ';
          timerLine.dataset.countdownTo = provider.cooldown_until;
          timerLine.textContent = 'Rate-limit cooldown active · Resets in ' + formatCountdown(provider.cooldown_until);
          cooldownBox.append(timerLine);
          if (provider.failover_provider) {
            const foLine = document.createElement('div');
            foLine.textContent = 'Failover active: remaining topics routed to ' + provider.failover_provider +
              (Array.isArray(provider.failover_categories) && provider.failover_categories.length
                ? ' (' + provider.failover_categories.join(', ') + ')'
                : '');
            cooldownBox.append(foLine);
          }
          const forceBtn = document.createElement('button');
          forceBtn.type = 'button';
          forceBtn.className = 'secondary small-btn';
          forceBtn.style.marginTop = '.35rem';
          forceBtn.textContent = 'Force retry now';
          forceBtn.disabled = state.busy.has(provider.id);
          forceBtn.addEventListener('click', () => updateProvider(provider.id, true));
          cooldownBox.append(forceBtn);
          card.append(cooldownBox);
        }

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

    function renderHistoryCategoryTabs() {
      historyCategoryEl.replaceChildren();
      categories.forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-tab';
        button.setAttribute('aria-pressed', String(state.activeHistoryCategory === category.id));
        button.textContent = category.icon + ' ' + category.label;
        button.addEventListener('click', () => {
          state.activeHistoryCategory = category.id;
          state.pages.decided = 1;
          renderHistoryCategoryTabs();
          renderStories(state.decidedStories, { decided: true });
        });
        historyCategoryEl.append(button);
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

      const selectedHistoryProvider = state.activeHistoryProvider;
      historyProviderFilterEl.replaceChildren();
      const allHistOption = document.createElement('option');
      allHistOption.value = 'all';
      allHistOption.textContent = 'All providers';
      historyProviderFilterEl.append(allHistOption);
      state.providers.forEach((provider) => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;
        historyProviderFilterEl.append(option);
      });
      state.activeHistoryProvider = state.providers.some(provider => provider.id === selectedHistoryProvider)
        ? selectedHistoryProvider
        : 'all';
      historyProviderFilterEl.value = state.activeHistoryProvider;
    }

    function attachSmoothImageLoader(imgEl, wrapEl = null, fallbackSrc = '') {
      imgEl.decoding = 'async';
      const markLoaded = () => {
        imgEl.classList.add('is-loaded');
        if (wrapEl) wrapEl.classList.add('is-loaded');
      };
      imgEl.addEventListener('load', markLoaded);
      imgEl.addEventListener('error', () => {
        if (fallbackSrc && imgEl.src !== fallbackSrc && !imgEl.src.endsWith(fallbackSrc)) {
          imgEl.src = fallbackSrc;
        } else {
          markLoaded();
        }
      });
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        markLoaded();
      }
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
      const fallbackImg = 'img/' + (story.category || 'all') + '_1.jpg';
      const image = document.createElement('img');
      image.src = story.image || fallbackImg;
      image.alt = '';
      image.loading = 'lazy';
      attachSmoothImageLoader(image, null, fallbackImg);
      row.append(image);
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

      if (isSearch || decided) {
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
      } else {
        if (!story.approved && !story.removed) {
          const approveBtn = document.createElement('button');
          approveBtn.type = 'button';
          approveBtn.className = 'small-btn';
          approveBtn.textContent = state.approving.has(story.id) ? 'Approving…' : 'Approve';
          approveBtn.disabled = state.approving.has(story.id);
          approveBtn.addEventListener('click', () => approveStory(story.id));
          actions.append(approveBtn);
        }
        if (story.approved && !story.removed) {
          const disapproveButton = document.createElement('button');
          disapproveButton.type = 'button';
          disapproveButton.className = 'secondary small-btn';
          disapproveButton.textContent = state.unapproving.has(story.id) ? 'Disapproving…' : 'Disapprove';
          disapproveButton.disabled = state.unapproving.has(story.id);
          disapproveButton.addEventListener('click', () => disapproveStory(story.id));
          actions.append(disapproveButton);
        }
        if (!story.removed) {
          const banButton = document.createElement('button');
          banButton.type = 'button';
          banButton.className = 'secondary small-btn';
          banButton.textContent = state.banning.has(story.id) ? 'Banning…' : 'Ban';
          banButton.disabled = state.banning.has(story.id);
          banButton.addEventListener('click', () => banStory(story.id));
          actions.append(banButton);
        }
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
        : decided
          ? stories.filter((story) =>
            (state.activeHistoryCategory === 'all' || story.category === state.activeHistoryCategory) &&
            (state.activeHistoryProvider === 'all' || story.provider === state.activeHistoryProvider))
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
              ? 'No stories in history match the current filters.'
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

    function doesStoryMatchQuery(story, q) {
      if (!story || !q) return false;
      const matchTitle = (story.title || '').toLowerCase().includes(q);
      const matchDesc = (story.description || '').toLowerCase().includes(q);
      const matchContent = (story.content || '').toLowerCase().includes(q);
      const matchSummary = (story.aiSummary || '').toLowerCase().includes(q);
      const matchSource = (story.source || '').toLowerCase().includes(q);
      const matchDomain = getStoryDomain(story.link).toLowerCase().includes(q);
      const matchCat = (story.category || '').toLowerCase().includes(q);
      const matchProvider = (story.provider || '').toLowerCase().includes(q);
      return Boolean(matchTitle || matchDesc || matchContent || matchSummary || matchSource || matchDomain || matchCat || matchProvider);
    }

    function applyStoryPatchAcrossAllLists(storyId, patch) {
      if (storyId == null || !patch) return;
      const numId = Number(storyId);
      const collections = [
        state.pendingStories,
        state.decidedStories,
        state.bannedStories,
        state.searchResults,
        state.aiCuration?.stagedPicks,
        state.aiCuration?.recentCuratedPicks
      ];
      collections.forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
          if (item && Number(item.id) === numId) {
            Object.assign(item, patch);
          }
        });
      });
    }

    function syncSearchResultsWithKnownLists() {
      if (!Array.isArray(state.searchResults) || !state.searchResults.length) return;
      const freshById = new Map();
      const freshByLink = new Map();
      [
        ...(state.aiCuration?.stagedPicks || []),
        ...state.pendingStories,
        ...state.decidedStories,
        ...state.bannedStories
      ].forEach((story) => {
        if (!story) return;
        if (story.id != null) freshById.set(Number(story.id), story);
        if (story.link) freshByLink.set(story.link, story);
      });
      state.searchResults.forEach((searchItem) => {
        if (!searchItem) return;
        const fresh = (searchItem.id != null && freshById.get(Number(searchItem.id))) ||
          (searchItem.link && freshByLink.get(searchItem.link));
        if (fresh) {
          Object.assign(searchItem, fresh);
        }
      });
    }

    function performStorySearch(skipRemoteFetch = false) {
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
        ...(state.aiCuration?.stagedPicks || []),
        ...state.searchResults
      ];
      const byKey = new Map();
      allKnownStories.forEach((story) => {
        if (!story) return;
        const key = story.id != null ? 'id:' + Number(story.id) : 'link:' + story.link;
        if (!byKey.has(key)) {
          byKey.set(key, story);
        } else {
          Object.assign(byKey.get(key), story);
        }
      });

      const matched = [];
      byKey.forEach((story) => {
        if (doesStoryMatchQuery(story, q)) {
          matched.push(story);
        }
      });

      renderStorySearchMatches(matched, q);

      if (!skipRemoteFetch && q.length >= 2) {
        request('/admin/api/stories/search?q=' + encodeURIComponent(q))
          .then((data) => {
            if (Array.isArray(data.items) && data.items.length) {
              let changed = false;
              data.items.forEach((item) => {
                const existingSearchIdx = state.searchResults.findIndex((s) =>
                  (item.id != null && s.id != null && Number(s.id) === Number(item.id)) ||
                  (item.link && s.link === item.link)
                );
                if (existingSearchIdx !== -1) {
                  Object.assign(state.searchResults[existingSearchIdx], item);
                } else {
                  state.searchResults.push(item);
                }

                const existingMatchIdx = matched.findIndex((s) =>
                  (item.id != null && s.id != null && Number(s.id) === Number(item.id)) ||
                  (item.link && s.link === item.link)
                );
                if (existingMatchIdx !== -1) {
                  Object.assign(matched[existingMatchIdx], item);
                  changed = true;
                } else if (doesStoryMatchQuery(item, q)) {
                  matched.push(item);
                  changed = true;
                }
              });
              if (changed && state.storySearchQuery.toLowerCase().trim() === q) {
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

    async function loadAwinStatus() {
      const statusEl = document.getElementById('awin-status-line');
      const btn = document.getElementById('awin-sync-btn');
      if (!statusEl || !btn) return;
      try {
        const data = await request('/admin/api/awin/status');
        if (!data.configured) {
          statusEl.textContent = ' - not configured (set the AWIN_API_TOKEN worker secret)';
          btn.disabled = true;
          return;
        }
        const last = data.runs && data.runs[0];
        const when = last && last.finished_at
          ? new Date(last.finished_at).toLocaleString()
          : 'never';
        statusEl.textContent = ' - ' + (data.programCount || 0) + ' programs | last sync: ' + when;
      } catch (err) {
        statusEl.textContent = ' - status unavailable';
      }
    }

    async function runAwinSync() {
      const btn = document.getElementById('awin-sync-btn');
      const logEl = document.getElementById('awin-sync-log');
      if (!btn || !logEl) return;
      btn.disabled = true;
      btn.textContent = '⟳ Syncing…';
      logEl.hidden = false;
      logEl.innerHTML = '';
      const line = (text, cls) => {
        const div = document.createElement('div');
        if (cls) div.className = cls;
        div.textContent = text;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
      };
      try {
        line('Starting Awin sync…');
        const result = await request('/admin/api/awin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeProducts: true }),
        });
        for (const s of result.steps || []) {
          line('- ' + s.name + ': ' + (s.detail || s.status), s.status === 'ok' ? 'ok' : 'warn');
        }
        if (result.ok) {
          line('Done - ' + (result.programs || 0) + ' programs, ' + (result.products || 0) + ' products.', 'ok');
        } else {
          line('Sync failed: ' + (result.error || 'unknown error'), 'err');
        }
        await loadAwinStatus();
        await loadAds();
      } catch (err) {
        line('Sync failed: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        btn.textContent = '⟳ Update Awin data';
      }
    }

    function filterAndRenderAds() {
      const q = state.adSearchQuery.toLowerCase().trim();
      const cat = state.activeAdCategory;
      const net = state.activeAdNetwork;
      const prog = state.activeAdProgram;
      const quality = state.activeAdQuality;
      // Reset select-all toggle label whenever the list re-renders.
      const selectAllBtn = document.getElementById('ads-select-all');
      if (selectAllBtn) selectAllBtn.textContent = 'Select all on page';
      const filtered = state.ads.filter((ad) => {
        if (cat !== 'all' && ad.category !== cat && ad.category !== 'all') return false;
        if (net !== 'all' && (ad.network || '').toLowerCase() !== net.toLowerCase()) return false;
        if (prog !== 'all' && net.toLowerCase() === 'awin') {
          const adProg = ad.sponsor || '';
          if (adProg !== prog) return false;
        }
        if (quality === 'needs-category' && ad.category && ad.category !== 'all') return false;
        if (quality === 'no-image' && ad.img) return false;
        if (quality === 'products' && !String(ad.id || '').startsWith('awin-product-')) return false;
        if (quality === 'programs' && !String(ad.id || '').startsWith('awin-program-')) return false;
        if (quality === 'hidden' && ad.enabled !== false) return false;
        if (quality === 'visible' && ad.enabled === false) return false;
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
          if (event.target.closest('button') || event.target.closest('input[type="checkbox"]')) return;
          openAdPreview(ad);
        });
        row.addEventListener('keydown', (event) => {
          if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openAdPreview(ad);
          }
        });

        const fallbackAdImg = 'img/' + (ad.category || 'all') + '_1.jpg';
        const selectBox = document.createElement('input');
        selectBox.type = 'checkbox';
        selectBox.className = 'ad-select';
        selectBox.checked = state.selectedAdIds.has(ad.id);
        selectBox.setAttribute('aria-label', 'Select ad: ' + decodeHtmlEntities(ad.title));
        selectBox.addEventListener('click', (e) => e.stopPropagation());
        selectBox.addEventListener('change', () => {
          if (selectBox.checked) state.selectedAdIds.add(ad.id);
          else state.selectedAdIds.delete(ad.id);
          updateBulkBar();
        });
        row.append(selectBox);

        const image = document.createElement('img');
        image.src = ad.img || fallbackAdImg;
        image.alt = '';
        image.loading = 'lazy';
        attachSmoothImageLoader(image, null, fallbackAdImg);
        row.append(image);

        const details = document.createElement('div');
        details.className = 'ad-details';
        const title = document.createElement('h3');
        title.textContent = decodeHtmlEntities(ad.title);
        if (ad.enabled === false) {
          const hiddenBadge = document.createElement('span');
          hiddenBadge.className = 'meta-badge-status meta-banned';
          hiddenBadge.textContent = ' Hidden';
          hiddenBadge.style.marginLeft = '.4rem';
          title.append(hiddenBadge);
          row.style.opacity = '0.6';
        }
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

        // Hide/Show toggle for Awin ads (persisted in Supabase).
        if (String(ad.id || '').startsWith('awin-')) {
          const toggleBtn = document.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'secondary small-btn';
          const isHidden = ad.enabled === false;
          toggleBtn.textContent = isHidden ? 'Show' : 'Hide';
          toggleBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            toggleBtn.disabled = true;
            try {
              await request('/admin/api/awin/ads/bulk', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [ad.id], enabled: isHidden })
              });
              ad.enabled = isHidden;
              filterAndRenderAds();
            } catch (err) {
              alert('Failed: ' + err.message);
              toggleBtn.disabled = false;
            }
          });
          actions.append(toggleBtn);
        }
        row.append(actions);

        adsListEl.append(row);
      });
    }

    function updateBulkBar() {
      const bar = document.getElementById('ads-bulk-bar');
      const count = state.selectedAdIds.size;
      bar.hidden = count === 0;
      document.getElementById('ads-bulk-count').textContent =
        count === 1 ? '1 ad selected' : count + ' ads selected';
    }

    // Populate bulk category dropdown from the site's categories.
    function populateBulkCategories() {
      const sel = document.getElementById('ads-bulk-category');
      sel.replaceChildren();
      for (const c of categories) {
        if (c.id === 'all') continue;
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        sel.append(opt);
      }
    }
    populateBulkCategories();

    document.getElementById('ads-bulk-clear').addEventListener('click', () => {
      state.selectedAdIds.clear();
      updateBulkBar();
      filterAndRenderAds();
    });

    async function bulkSetEnabled(enabled) {
      const ids = [...state.selectedAdIds].filter(id => String(id).startsWith('awin-'));
      if (!ids.length) {
        alert('Select at least one Awin ad.');
        return;
      }
      try {
        await request('/admin/api/awin/ads/bulk', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, enabled })
        });
        for (const ad of state.ads) {
          if (state.selectedAdIds.has(ad.id)) ad.enabled = enabled;
        }
        state.selectedAdIds.clear();
        updateBulkBar();
        filterAndRenderAds();
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    }

    document.getElementById('ads-bulk-hide').addEventListener('click', () => bulkSetEnabled(false));
    document.getElementById('ads-bulk-show').addEventListener('click', () => bulkSetEnabled(true));

    document.getElementById('ads-select-all').addEventListener('click', () => {
      // Select all ads on the current page (respecting active filters).
      const q = state.adSearchQuery.toLowerCase().trim();
      const cat = state.activeAdCategory;
      const net = state.activeAdNetwork;
      const prog = state.activeAdProgram;
      const quality = state.activeAdQuality;
      const filtered = state.ads.filter((ad) => {
        if (cat !== 'all' && ad.category !== cat && ad.category !== 'all') return false;
        if (net !== 'all' && (ad.network || '').toLowerCase() !== net.toLowerCase()) return false;
        if (prog !== 'all' && net.toLowerCase() === 'awin' && (ad.sponsor || '') !== prog) return false;
        if (quality === 'needs-category' && ad.category && ad.category !== 'all') return false;
        if (quality === 'no-image' && ad.img) return false;
        if (quality === 'products' && !String(ad.id || '').startsWith('awin-product-')) return false;
        if (quality === 'programs' && !String(ad.id || '').startsWith('awin-program-')) return false;
        if (quality === 'hidden' && ad.enabled !== false) return false;
        if (quality === 'visible' && ad.enabled === false) return false;
        return true;
      });
      // Only the current pagination slice.
      const pageSize = state.pageSizes.ads || 10;
      const page = state.pages.ads || 1;
      const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
      // Toggle: if all on page are selected, deselect them; otherwise select them.
      const allSelected = slice.length > 0 && slice.every(ad => state.selectedAdIds.has(ad.id));
      for (const ad of slice) {
        if (allSelected) state.selectedAdIds.delete(ad.id);
        else state.selectedAdIds.add(ad.id);
      }
      document.getElementById('ads-select-all').textContent =
        allSelected ? 'Select all on page' : 'Deselect all on page';
      updateBulkBar();
      filterAndRenderAds();
    });

    document.getElementById('ads-bulk-apply').addEventListener('click', async () => {
      const category = document.getElementById('ads-bulk-category').value;
      const ids = [...state.selectedAdIds];
      if (!ids.length || !category) return;
      const btn = document.getElementById('ads-bulk-apply');
      btn.disabled = true;
      btn.textContent = 'Applying…';
      try {
        // Split Awin ads (persisted in Supabase) from in-memory ads.
        const awinIds = ids.filter(id => String(id).startsWith('awin-'));
        if (awinIds.length) {
          await request('/admin/api/awin/ads/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: awinIds, category })
          });
        }
        // Update local state for all selected ads.
        for (const ad of state.ads) {
          if (state.selectedAdIds.has(ad.id)) ad.category = category;
        }
        state.selectedAdIds.clear();
        updateBulkBar();
        filterAndRenderAds();
      } catch (err) {
        alert('Bulk update failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Apply to selected';
      }
    });

    adSearchInput.addEventListener('input', () => {
      state.adSearchQuery = adSearchInput.value;
      state.pages.ads = 1;
      filterAndRenderAds();
    });

    adsNetworkFilterEl.addEventListener('change', () => {
      state.activeAdNetwork = adsNetworkFilterEl.value;
      state.activeAdProgram = 'all';
      state.pages.ads = 1;
      updateProgramFilter();
      filterAndRenderAds();
    });

    const adsProgramFilterEl = document.getElementById('ads-program-filter');
    const adsProgramFilterWrap = document.getElementById('ads-program-filter-wrap');
    const adsQualityFilterEl = document.getElementById('ads-quality-filter');

    function updateProgramFilter() {
      const isAwin = state.activeAdNetwork.toLowerCase() === 'awin';
      adsProgramFilterWrap.hidden = !isAwin;
      if (!isAwin) return;
      const programs = [...new Set(
        state.ads
          .filter(ad => (ad.network || '').toLowerCase() === 'awin')
          .map(ad => ad.sponsor || 'Unknown')
      )].sort();
      adsProgramFilterEl.replaceChildren();
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.textContent = 'All programs (' + programs.length + ')';
      adsProgramFilterEl.append(allOpt);
      for (const p of programs) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        adsProgramFilterEl.append(opt);
      }
      adsProgramFilterEl.value = 'all';
    }

    adsProgramFilterEl.addEventListener('change', () => {
      state.activeAdProgram = adsProgramFilterEl.value;
      state.pages.ads = 1;
      filterAndRenderAds();
    });

    adsQualityFilterEl.addEventListener('change', () => {
      state.activeAdQuality = adsQualityFilterEl.value;
      state.pages.ads = 1;
      filterAndRenderAds();
    });

    document.getElementById('create-ad-btn').addEventListener('click', () => {
      openAdPreview(null);
    });

    document.getElementById('awin-sync-btn').addEventListener('click', runAwinSync);
    loadAwinStatus();

    /* ============================================================================
     * AI DAILY STORY CURATION & STAGING QUEUE (5 Stories/Category · 3x/Day)
     * ============================================================================ */

    function getVisibleAiStagedPicks() {
      const picks = Array.isArray(state.aiCuration?.stagedPicks) ? state.aiCuration.stagedPicks : [];
      return picks.filter((pick) => {
        if (state.ignored.has(pick.id)) return false;
        if (state.activeAiSlot !== 'all' && pick.slot !== state.activeAiSlot) return false;
        if (state.activeAiCategory !== 'all_categories' && pick.category !== state.activeAiCategory) return false;
        return true;
      });
    }

    function renderAiCurationHeaderBar() {
      const bar = document.getElementById('ai-curation-bar');
      const countEl = document.getElementById('ai-staging-count');
      if (!bar) return;

      const ai = state.aiCuration || {};
      const stagedCount = Array.isArray(ai.stagedPicks) ? ai.stagedPicks.length : 0;
      if (countEl) {
        countEl.textContent = stagedCount > 0 ? '(' + stagedCount + ' staged)' : '(0 staged)';
      }

      bar.replaceChildren();

      const info = document.createElement('div');
      info.className = 'ai-curation-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'ai-curation-title';
      titleRow.textContent = '3x Daily AI Curation (5 / category): ';
      const statusBadge = document.createElement('span');
      statusBadge.className = 'status ' + (ai.enabled ? 'status-succeeded' : 'status-partial');
      statusBadge.textContent = ai.enabled
        ? 'Active · Morning (08:00), Afternoon (13:00), Evening (18:00)'
        : 'Paused';
      titleRow.append(statusBadge);

      const metaRow = document.createElement('div');
      metaRow.className = 'ai-curation-meta tabular-nums';
      const lastRunStr = ai.lastRunAt
        ? formatDateTime(new Date(ai.lastRunAt)) + ' (' + (ai.lastSlot || 'latest') + ' · ' + (ai.lastTrigger || 'auto') + ')'
        : 'Not run yet';
      const completedStr = Array.isArray(ai.completedSlotsToday) && ai.completedSlotsToday.length
        ? ai.completedSlotsToday.join(', ')
        : 'none yet';
      metaRow.textContent = 'Active window: ' + (ai.currentSlotLabel || 'Morning Edition') +
        ' · Last run: ' + lastRunStr +
        ' · Completed today: ' + completedStr + ' · ';

      if (ai.enabled && ai.nextRunAt) {
        const nextSpan = document.createElement('span');
        nextSpan.dataset.countdownPrefix = 'Next window (' + (ai.nextSlot || 'scheduled') + ') in ';
        nextSpan.dataset.countdownTo = ai.nextRunAt;
        nextSpan.textContent = 'Next window (' + (ai.nextSlot || 'scheduled') + ') in ' + formatCountdown(ai.nextRunAt);
        metaRow.append(nextSpan);
      }

      info.append(titleRow, metaRow);
      if (ai.lastSummary) {
        const sumLine = document.createElement('div');
        sumLine.className = 'ai-curation-meta';
        sumLine.textContent = ai.lastSummary;
        info.append(sumLine);
      }

      const actions = document.createElement('div');
      actions.className = 'ai-curation-actions';

      const slotSelect = document.createElement('select');
      slotSelect.id = 'ai-slot-select';
      slotSelect.className = 'provider-filter';
      slotSelect.setAttribute('aria-label', 'Select daily edition slot to curate');
      [
        { value: 'auto', label: 'Current Window (' + (ai.currentSlot || 'morning') + ')' },
        { value: 'morning', label: 'Morning Edition (08:00)' },
        { value: 'afternoon', label: 'Afternoon Edition (13:00)' },
        { value: 'evening', label: 'Evening Edition (18:00)' }
      ].forEach((optItem) => {
        const opt = document.createElement('option');
        opt.value = optItem.value;
        opt.textContent = optItem.label;
        slotSelect.append(opt);
      });
      slotSelect.value = state.selectedRunSlot || 'auto';
      slotSelect.addEventListener('change', () => {
        state.selectedRunSlot = slotSelect.value;
      });

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'secondary small-btn';
      toggleBtn.disabled = state.togglingAiSchedule;
      toggleBtn.textContent = ai.enabled ? 'Pause 3x/day schedule' : 'Enable 3x/day schedule';
      toggleBtn.addEventListener('click', toggleAiSchedule);

      const runBtn = document.createElement('button');
      runBtn.id = 'run-ai-curation-btn';
      runBtn.type = 'button';
      runBtn.className = 'small-btn';
      runBtn.disabled = state.curatingAi;
      runBtn.textContent = state.curatingAi ? 'Curating 5/Category…' : 'Curate 5/Category Now';
      runBtn.addEventListener('click', () => runAiCurationNow());

      actions.append(slotSelect, toggleBtn, runBtn);
      bar.append(info, actions);
    }

    function renderAiTasteDrawer() {
      const drawer = document.getElementById('ai-taste-drawer');
      const toggleBtn = document.getElementById('toggle-taste-drawer-btn');
      if (!drawer) return;
      drawer.hidden = !state.tasteDrawerOpen;
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(state.tasteDrawerOpen));
        toggleBtn.textContent = state.tasteDrawerOpen ? 'Hide Taste Profile' : 'Taste Profile & Schedule';
      }
      if (!state.tasteDrawerOpen) return;

      drawer.replaceChildren();
      const signals = state.aiCuration?.learnedSignals || {};
      const profile = state.aiCuration?.tasteProfile || {};

      const signalGrid = document.createElement('div');
      signalGrid.className = 'ai-signal-grid';

      const historyBox = document.createElement('div');
      historyBox.className = 'ai-signal-box tabular-nums';
      const histTitle = document.createElement('strong');
      histTitle.textContent = 'Learned Decision History';
      historyBox.append(
        histTitle,
        document.createTextNode(
          (signals.approvedCount || 0) + ' approved stories · ' +
          (signals.rejectedCount || 0) + ' rejected/banned stories analyzed'
        )
      );

      const sourcesBox = document.createElement('div');
      sourcesBox.className = 'ai-signal-box';
      const srcTitle = document.createElement('strong');
      srcTitle.textContent = 'Top Approved Sources';
      const topSources = (signals.topApprovedSources || []).map(s => s.name + ' (' + s.count + ')').join(', ');
      sourcesBox.append(srcTitle, document.createTextNode(topSources || 'Learning as you approve stories'));

      const termsBox = document.createElement('div');
      termsBox.className = 'ai-signal-box';
      const termsTitle = document.createElement('strong');
      termsTitle.textContent = 'Learned High-Affinity Themes';
      const topTerms = (signals.topApprovedTerms || []).slice(0, 8).map(t => t.name).join(', ');
      termsBox.append(termsTitle, document.createTextNode(topTerms || 'Building keyword affinity from approvals'));

      const avoidedBox = document.createElement('div');
      avoidedBox.className = 'ai-signal-box';
      const avoidTitle = document.createElement('strong');
      avoidTitle.textContent = 'Avoided Patterns (Rejected/Banned)';
      const avoidedTerms = (signals.avoidedTerms || []).slice(0, 6).map(t => t.name).join(', ');
      avoidedBox.append(avoidTitle, document.createTextNode(avoidedTerms || 'None flagged yet'));

      signalGrid.append(historyBox, sourcesBox, termsBox, avoidedBox);
      drawer.append(signalGrid);

      const instructionsWrap = document.createElement('div');
      instructionsWrap.className = 'ai-taste-field';
      const instLabel = document.createElement('label');
      instLabel.setAttribute('for', 'ai-taste-instructions');
      instLabel.textContent = 'Editable Editorial Taste Profile (guides AI story selection across all categories)';
      const instTextarea = document.createElement('textarea');
      instTextarea.id = 'ai-taste-instructions';
      instTextarea.rows = 3;
      instTextarea.value = profile.customInstructions || '';
      instTextarea.placeholder = 'Describe the stories, tone, and themes you enjoy and approve…';
      instructionsWrap.append(instLabel, instTextarea);
      drawer.append(instructionsWrap);

      const twoCol = document.createElement('div');
      twoCol.className = 'ai-taste-two-col';

      const prefWrap = document.createElement('div');
      prefWrap.className = 'ai-taste-field';
      const prefLabel = document.createElement('label');
      prefLabel.setAttribute('for', 'ai-taste-preferred');
      prefLabel.textContent = 'Preferred Keywords (comma-separated boost)';
      const prefInput = document.createElement('input');
      prefInput.id = 'ai-taste-preferred';
      prefInput.type = 'text';
      prefInput.value = profile.preferredKeywords || '';
      prefWrap.append(prefLabel, prefInput);

      const mutedWrap = document.createElement('div');
      mutedWrap.className = 'ai-taste-field';
      const mutedLabel = document.createElement('label');
      mutedLabel.setAttribute('for', 'ai-taste-muted');
      mutedLabel.textContent = 'Muted / Excluded Keywords (comma-separated penalty)';
      const mutedInput = document.createElement('input');
      mutedInput.id = 'ai-taste-muted';
      mutedInput.type = 'text';
      mutedInput.value = profile.mutedKeywords || '';
      mutedWrap.append(mutedLabel, mutedInput);

      twoCol.append(prefWrap, mutedWrap);
      drawer.append(twoCol);

      const btnRow = document.createElement('div');
      btnRow.className = 'editor-btn-row';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'secondary small-btn';
      saveBtn.disabled = state.savingTasteProfile;
      saveBtn.textContent = state.savingTasteProfile ? 'Saving…' : 'Save Taste Profile';
      saveBtn.addEventListener('click', () => saveAiTasteProfile(false));

      const saveAndRunBtn = document.createElement('button');
      saveAndRunBtn.type = 'button';
      saveAndRunBtn.className = 'small-btn';
      saveAndRunBtn.disabled = state.savingTasteProfile || state.curatingAi;
      saveAndRunBtn.textContent = state.savingTasteProfile ? 'Re-curating…' : 'Save & Re-Curate 5/Category Now';
      saveAndRunBtn.addEventListener('click', () => saveAiTasteProfile(true));

      btnRow.append(saveBtn, saveAndRunBtn);
      drawer.append(btnRow);
    }

    function renderAiEditionAndCategoryTabs() {
      const editionNav = document.getElementById('ai-edition-tabs');
      const catNav = document.getElementById('ai-staging-categories');
      const allStaged = Array.isArray(state.aiCuration?.stagedPicks) ? state.aiCuration.stagedPicks : [];

      if (editionNav) {
        editionNav.replaceChildren();
        const editions = [
          { id: 'all', label: 'All Editions (' + allStaged.length + ')' },
          { id: 'morning', label: 'Morning · 08:00 (' + allStaged.filter(p => p.slot === 'morning').length + ')' },
          { id: 'afternoon', label: 'Afternoon · 13:00 (' + allStaged.filter(p => p.slot === 'afternoon').length + ')' },
          { id: 'evening', label: 'Evening · 18:00 (' + allStaged.filter(p => p.slot === 'evening').length + ')' }
        ];
        editions.forEach((ed) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'category-tab tabular-nums';
          btn.setAttribute('aria-pressed', String(state.activeAiSlot === ed.id));
          btn.textContent = ed.label;
          btn.addEventListener('click', () => {
            state.activeAiSlot = ed.id;
            state.pages.aiStaging = 1;
            renderAiStagingSection();
          });
          editionNav.append(btn);
        });
      }

      if (catNav) {
        catNav.replaceChildren();
        const slotFiltered = state.activeAiSlot === 'all'
          ? allStaged
          : allStaged.filter(p => p.slot === state.activeAiSlot);

        const allCatBtn = document.createElement('button');
        allCatBtn.type = 'button';
        allCatBtn.className = 'category-tab tabular-nums';
        allCatBtn.setAttribute('aria-pressed', String(state.activeAiCategory === 'all_categories'));
        allCatBtn.textContent = 'All Categories (' + slotFiltered.length + ')';
        allCatBtn.addEventListener('click', () => {
          state.activeAiCategory = 'all_categories';
          state.pages.aiStaging = 1;
          renderAiStagingSection();
        });
        catNav.append(allCatBtn);

        categories.forEach((cat) => {
          const count = slotFiltered.filter(p => p.category === cat.id).length;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'category-tab tabular-nums';
          btn.setAttribute('aria-pressed', String(state.activeAiCategory === cat.id));
          btn.textContent = cat.icon + ' ' + cat.label + ' (' + count + '/5)';
          btn.addEventListener('click', () => {
            state.activeAiCategory = cat.id;
            state.pages.aiStaging = 1;
            renderAiStagingSection();
          });
          catNav.append(btn);
        });
      }
    }

    function renderAiBulkActionBar(visiblePicks) {
      const bulkBar = document.getElementById('ai-bulk-bar');
      if (!bulkBar) return;
      bulkBar.replaceChildren();

      // Clean up selected IDs that are no longer in stagedPicks
      const activeIds = new Set((state.aiCuration?.stagedPicks || []).map(p => Number(p.id)));
      Array.from(state.selectedAiStoryIds).forEach((id) => {
        if (!activeIds.has(Number(id))) state.selectedAiStoryIds.delete(id);
      });

      const selectedCount = state.selectedAiStoryIds.size;
      const allVisibleSelected = visiblePicks.length > 0 &&
        visiblePicks.every(p => state.selectedAiStoryIds.has(Number(p.id)));

      const left = document.createElement('div');
      left.className = 'ai-bulk-left';

      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.className = 'secondary small-btn';
      selectAllBtn.disabled = visiblePicks.length === 0;
      selectAllBtn.textContent = allVisibleSelected
        ? 'Clear Visible (' + visiblePicks.length + ')'
        : 'Select Visible (' + visiblePicks.length + ')';
      selectAllBtn.addEventListener('click', () => {
        if (allVisibleSelected) {
          visiblePicks.forEach(p => state.selectedAiStoryIds.delete(Number(p.id)));
        } else {
          visiblePicks.forEach(p => state.selectedAiStoryIds.add(Number(p.id)));
        }
        renderAiStagingSection();
      });

      const selectionLabel = document.createElement('span');
      selectionLabel.className = 'muted tabular-nums';
      selectionLabel.textContent = selectedCount > 0
        ? selectedCount + ' story' + (selectedCount === 1 ? '' : 'ies') + ' selected'
        : 'Select stories for bulk promotion or rejection';

      left.append(selectAllBtn, selectionLabel);

      const right = document.createElement('div');
      right.className = 'ai-bulk-right';

      const approveSelectedBtn = document.createElement('button');
      approveSelectedBtn.type = 'button';
      approveSelectedBtn.className = 'small-btn btn-approve-accent tabular-nums';
      approveSelectedBtn.disabled = selectedCount === 0 || state.bulkDecidingAi;
      approveSelectedBtn.textContent = 'Approve Selected (' + selectedCount + ')';
      approveSelectedBtn.addEventListener('click', () => {
        bulkDecideAiStagedStories(Array.from(state.selectedAiStoryIds), 'approve');
      });

      const approveVisibleBtn = document.createElement('button');
      approveVisibleBtn.type = 'button';
      approveVisibleBtn.className = 'secondary small-btn tabular-nums';
      approveVisibleBtn.disabled = visiblePicks.length === 0 || state.bulkDecidingAi;
      approveVisibleBtn.textContent = state.activeAiCategory === 'all_categories'
        ? 'Approve All Staged (' + visiblePicks.length + ')'
        : 'Approve Category (' + visiblePicks.length + ')';
      approveVisibleBtn.addEventListener('click', () => {
        bulkDecideAiStagedStories(visiblePicks.map(p => Number(p.id)), 'approve');
      });

      const disapproveSelectedBtn = document.createElement('button');
      disapproveSelectedBtn.type = 'button';
      disapproveSelectedBtn.className = 'secondary small-btn tabular-nums';
      disapproveSelectedBtn.disabled = selectedCount === 0 || state.bulkDecidingAi;
      disapproveSelectedBtn.textContent = 'Disapprove Selected (' + selectedCount + ')';
      disapproveSelectedBtn.addEventListener('click', () => {
        bulkDecideAiStagedStories(Array.from(state.selectedAiStoryIds), 'disapprove');
      });

      const banSelectedBtn = document.createElement('button');
      banSelectedBtn.type = 'button';
      banSelectedBtn.className = 'small-btn btn-danger-outline tabular-nums';
      banSelectedBtn.disabled = selectedCount === 0 || state.bulkDecidingAi;
      banSelectedBtn.textContent = 'Ban Selected (' + selectedCount + ')';
      banSelectedBtn.addEventListener('click', () => {
        bulkDecideAiStagedStories(Array.from(state.selectedAiStoryIds), 'ban');
      });

      right.append(approveSelectedBtn, approveVisibleBtn, disapproveSelectedBtn, banSelectedBtn);
      bulkBar.append(left, right);
    }

    function createAiStagedStoryRow(pick) {
      const row = document.createElement('article');
      row.className = 'story ai-pick-row';
      row.tabIndex = 0;
      row.setAttribute('aria-label', 'Review AI staged story: ' + decodeHtmlEntities(pick.title));
      row.addEventListener('click', (event) => {
        if (event.target.closest('button') || event.target.closest('input[type="checkbox"]')) return;
        openStoryPreview(pick);
      });
      row.addEventListener('keydown', (event) => {
        if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          openStoryPreview(pick);
        }
      });

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'ai-pick-checkbox';
      checkbox.checked = state.selectedAiStoryIds.has(Number(pick.id));
      checkbox.setAttribute('aria-label', 'Select ' + decodeHtmlEntities(pick.title));
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (checkbox.checked) state.selectedAiStoryIds.add(Number(pick.id));
        else state.selectedAiStoryIds.delete(Number(pick.id));
        renderAiBulkActionBar(getVisibleAiStagedPicks());
      });
      row.append(checkbox);

      const fallbackPickImg = 'img/' + (pick.category || 'all') + '_1.jpg';
      const image = document.createElement('img');
      image.src = pick.image || fallbackPickImg;
      image.alt = '';
      image.loading = 'lazy';
      attachSmoothImageLoader(image, null, fallbackPickImg);
      row.append(image);

      const details = document.createElement('div');
      details.className = 'story-details';

      const title = document.createElement('h3');
      const link = document.createElement('a');
      link.href = decodeHtmlEntities(pick.link);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = decodeHtmlEntities(pick.title);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openStoryPreview(pick);
      });
      title.append(link);

      const meta = document.createElement('p');
      meta.className = 'story-meta';
      const catLabel = categories.find(c => c.id === pick.category)?.label || pick.category;
      const slotShort = pick.slot === 'morning'
        ? 'Morning Edition'
        : pick.slot === 'afternoon'
          ? 'Afternoon Edition'
          : 'Evening Edition';

      [
        ['meta-rank', 'Pick #' + (pick.rank || 1) + ' in ' + catLabel],
        ['meta-slot', '· ' + slotShort],
        ['meta-provider', '· ' + (pick.provider || 'unknown')],
        ['meta-domain', '· ' + getStoryDomain(pick.link)]
      ].forEach(([cls, val]) => {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = val;
        meta.append(span);
      });

      const updated = document.createElement('span');
      updated.className = 'meta-date';
      updated.dataset.updatedPrefix = '· Curated: ';
      updated.dataset.updatedAt = pick.curatedAt || pick.updatedAt || '';
      meta.append(updated);

      const reasonP = document.createElement('p');
      reasonP.className = 'ai-pick-reason';
      reasonP.textContent = pick.reason || 'Selected by AI curator based on your editorial taste profile and approval history.';

      details.append(title, meta, reasonP);
      const main = document.createElement('div');
      main.className = 'story-main';
      main.append(details);
      row.append(main);

      const actions = document.createElement('div');
      actions.className = 'story-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'secondary small-btn';
      editBtn.textContent = 'Preview / Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStoryPreview(pick);
      });

      const approveBtn = document.createElement('button');
      approveBtn.type = 'button';
      approveBtn.className = 'small-btn btn-approve-accent';
      approveBtn.textContent = state.approving.has(pick.id) ? 'Approving…' : 'Approve';
      approveBtn.disabled = state.approving.has(pick.id);
      approveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        approveStory(pick.id);
      });

      const disapproveBtn = document.createElement('button');
      disapproveBtn.type = 'button';
      disapproveBtn.className = 'secondary small-btn';
      disapproveBtn.textContent = state.unapproving.has(pick.id) ? 'Rejecting…' : 'Disapprove';
      disapproveBtn.disabled = state.unapproving.has(pick.id);
      disapproveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        disapproveStory(pick.id);
      });

      const banBtn = document.createElement('button');
      banBtn.type = 'button';
      banBtn.className = 'small-btn btn-danger-outline';
      banBtn.textContent = state.banning.has(pick.id) ? 'Banning…' : 'Ban';
      banBtn.disabled = state.banning.has(pick.id);
      banBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        banStory(pick.id);
      });

      actions.append(editBtn, approveBtn, disapproveBtn, banBtn);
      row.append(actions);
      return row;
    }

    function renderAiStagingSection() {
      renderAiCurationHeaderBar();
      renderAiTasteDrawer();
      renderAiEditionAndCategoryTabs();

      const visiblePicks = getVisibleAiStagedPicks();
      renderAiBulkActionBar(visiblePicks);

      const listEl = document.getElementById('ai-staged-stories');
      if (!listEl) return;
      listEl.replaceChildren();

      const pager = renderPaginationBar('ai-staging-pagination', 'aiStaging', visiblePicks.length, () => {
        renderAiStagingSection();
        refreshStoryAges();
      });

      if (!visiblePicks.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        const totalStaged = (state.aiCuration?.stagedPicks || []).length;
        empty.textContent = totalStaged === 0
          ? 'No AI-curated stories are currently staged. Click "Curate 5/Category Now" above to have the AI select 5 stories from each category tailored to your approval history and taste profile.'
          : 'No staged AI picks match the selected edition or category filter.';
        listEl.append(empty);
        return;
      }

      pager.slice(visiblePicks).forEach((pick) => {
        listEl.append(createAiStagedStoryRow(pick));
      });
    }

    async function runAiCurationNow(overrideSlot = null) {
      if (state.curatingAi) return;
      state.curatingAi = true;
      renderAiCurationHeaderBar();
      const targetSlot = overrideSlot || (state.selectedRunSlot !== 'auto' ? state.selectedRunSlot : null);
      messageEl.className = 'muted';
      messageEl.textContent = 'AI Curator is evaluating unapproved stories across all 7 categories…';
      try {
        const res = await request('/admin/api/ai-curation/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: targetSlot,
            triggerSource: 'manual'
          })
        });
        if (res.aiCuration) state.aiCuration = res.aiCuration;
        state.pages.aiStaging = 1;
        renderAiStagingSection();
        refreshStoryAges();
        messageEl.className = 'success';
        messageEl.textContent = res.aiCuration?.lastSummary ||
          ('AI staged ' + (res.totalStagedInRun || 0) + ' stories across categories.');
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'AI story curation failed: ' + error.message;
      } finally {
        state.curatingAi = false;
        renderAiCurationHeaderBar();
      }
    }

    async function toggleAiSchedule() {
      if (state.togglingAiSchedule) return;
      state.togglingAiSchedule = true;
      renderAiCurationHeaderBar();
      try {
        const nextEnabled = !(state.aiCuration?.enabled);
        const res = await request('/admin/api/ai-curation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: nextEnabled })
        });
        if (res.aiCuration) state.aiCuration = res.aiCuration;
        renderAiStagingSection();
        messageEl.className = 'success';
        messageEl.textContent = state.aiCuration.enabled
          ? '3x/day automatic AI story curation (Morning, Afternoon, Evening) enabled.'
          : '3x/day automatic AI story curation paused.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not update AI schedule: ' + error.message;
      } finally {
        state.togglingAiSchedule = false;
        renderAiCurationHeaderBar();
      }
    }

    async function saveAiTasteProfile(reCurate = false) {
      if (state.savingTasteProfile) return;
      state.savingTasteProfile = true;
      renderAiTasteDrawer();
      const instructionsEl = document.getElementById('ai-taste-instructions');
      const preferredEl = document.getElementById('ai-taste-preferred');
      const mutedEl = document.getElementById('ai-taste-muted');
      const payload = {
        customInstructions: instructionsEl ? instructionsEl.value.trim() : '',
        preferredKeywords: preferredEl ? preferredEl.value.trim() : '',
        mutedKeywords: mutedEl ? mutedEl.value.trim() : '',
        reCurate: Boolean(reCurate),
        slot: state.selectedRunSlot !== 'auto' ? state.selectedRunSlot : null
      };
      messageEl.className = 'muted';
      messageEl.textContent = reCurate
        ? 'Saving taste profile and re-curating 5 stories per category…'
        : 'Saving editorial taste profile…';
      try {
        const res = await request('/admin/api/ai-curation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.aiCuration) state.aiCuration = res.aiCuration;
        renderAiStagingSection();
        refreshStoryAges();
        messageEl.className = 'success';
        messageEl.textContent = reCurate
          ? (res.aiCuration?.lastSummary || 'Taste profile saved and staging queue refreshed.')
          : 'Editorial taste profile saved.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not save taste profile: ' + error.message;
      } finally {
        state.savingTasteProfile = false;
        renderAiTasteDrawer();
      }
    }

    async function bulkDecideAiStagedStories(storyIds, action) {
      const ids = Array.isArray(storyIds) ? storyIds.filter(Boolean) : [];
      if (!ids.length || state.bulkDecidingAi) return;
      state.bulkDecidingAi = true;
      renderAiBulkActionBar(getVisibleAiStagedPicks());
      const actionVerb = action === 'approve'
        ? 'Approving'
        : action === 'ban'
          ? 'Banning'
          : 'Disapproving';
      messageEl.className = 'muted';
      messageEl.textContent = actionVerb + ' ' + ids.length + ' staged ' + (ids.length === 1 ? 'story' : 'stories') + '…';
      try {
        const res = await request('/admin/api/ai-curation/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyIds: ids, action })
        });
        ids.forEach(id => state.selectedAiStoryIds.delete(Number(id)));
        if (res.aiCuration) state.aiCuration = res.aiCuration;
        await refreshData();
        messageEl.className = 'success';
        const doneLabel = action === 'approve'
          ? 'promoted to Approved Stories'
          : action === 'ban'
            ? 'banned from public feeds'
            : 'marked Disapproved';
        messageEl.textContent = (res.succeededCount || ids.length) + ' AI-staged ' +
          ((res.succeededCount || ids.length) === 1 ? 'story ' : 'stories ') + doneLabel + '.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Bulk ' + action + ' failed: ' + error.message;
      } finally {
        state.bulkDecidingAi = false;
        renderAiStagingSection();
      }
    }

    document.getElementById('toggle-taste-drawer-btn').addEventListener('click', () => {
      state.tasteDrawerOpen = !state.tasteDrawerOpen;
      renderAiTasteDrawer();
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
        if (data.autoSync) state.autoSync = data.autoSync;
        if (data.aiCuration) state.aiCuration = data.aiCuration;
        if (data.providerLogs) {
          state.providerLogs = data.providerLogs.logs || [];
          state.providerLogsSummary = data.providerLogs.summary || state.providerLogsSummary;
        }
        syncSearchResultsWithKnownLists();
        renderProviders(data.providers);
        renderProviderFilter();
        renderLogFilterOptions();
        renderProviderLogs();
        renderAiStagingSection();
        document.getElementById('total').textContent = data.totalStories.toLocaleString();
        document.getElementById('pending-count').textContent = state.pendingStories.length
          ? '(' + state.pendingStories.length + (state.pendingStories.length === 100 ? '+' : '') + ')'
          : '';
        document.getElementById('history-count').textContent = state.decidedStories.length
          ? '(' + state.decidedStories.length + ')'
          : '';
        document.getElementById('banned-count').textContent = state.bannedStories.length
          ? '(' + state.bannedStories.length + ')'
          : '';
        renderCategoryTabs();
        renderHistoryCategoryTabs();
        renderAdsCategoryTabs();
        renderStories(state.pendingStories, { pending: true });
        renderStories(state.decidedStories, { decided: true });
        renderStories(state.bannedStories, { banned: true });
        if (state.storySearchQuery.trim()) {
          performStorySearch();
        }
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
      renderAiStagingSection();
      if (state.storySearchQuery.trim()) performStorySearch(true);
      try {
        await request('/admin/api/stories/' + encodeURIComponent(storyId) + '/approve', { method: 'POST' });
        state.selectedAiStoryIds.delete(Number(storyId));
        applyStoryPatchAcrossAllLists(storyId, {
          approved: true,
          removed: false,
          decisionAction: 'approve',
          updatedAt: new Date().toISOString()
        });
        await refreshData();
        messageEl.className = 'success';
        messageEl.textContent = 'Story approved and published.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Story approval failed: ' + error.message;
      } finally {
        state.approving.delete(storyId);
        renderAiStagingSection();
        if (state.storySearchQuery.trim()) performStorySearch(true);
      }
    }

    async function postStoryDecision(storyId, action, busySet, successMessage) {
      if (busySet.has(storyId)) return;
      busySet.add(storyId);
      renderStories(state.pendingStories, { pending: true });
      renderStories(state.decidedStories, { decided: true });
      renderStories(state.bannedStories, { banned: true });
      renderAiStagingSection();
      if (state.storySearchQuery.trim()) performStorySearch(true);
      try {
        await request('/admin/api/stories/' + encodeURIComponent(storyId) + '/' + action, { method: 'POST' });
        state.selectedAiStoryIds.delete(Number(storyId));
        if (action === 'disapprove') {
          applyStoryPatchAcrossAllLists(storyId, {
            approved: false,
            removed: false,
            decisionAction: 'disapprove',
            updatedAt: new Date().toISOString()
          });
        } else if (action === 'ban') {
          applyStoryPatchAcrossAllLists(storyId, {
            approved: false,
            removed: true,
            decisionAction: 'ban',
            updatedAt: new Date().toISOString()
          });
        }
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
        renderAiStagingSection();
        if (state.storySearchQuery.trim()) performStorySearch(true);
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

    async function updateProvider(providerId, force = false) {
      if (state.busy.has(providerId)) return;
      state.busy.add(providerId);
      renderProviders(state.providers);
      messageEl.className = 'muted';
      messageEl.textContent = 'Updating ' + providerId + (force ? ' (forced)…' : '…');
      try {
        const suffix = force ? '?force=1' : '';
        const result = await request('/admin/api/providers/' + encodeURIComponent(providerId) + '/update' + suffix, { method: 'POST' });
        messageEl.className = result.status === 'succeeded' ? 'success' : 'error';
        if (result.status === 'succeeded') {
          messageEl.textContent = providerId + ': saved ' + result.storiesSaved + ' stories.';
        } else if (result.rateLimited) {
          messageEl.textContent = providerId + ' hit rate limit (saved ' + result.storiesSaved +
            (result.failoverProvider ? ', failed over remaining topics to ' + result.failoverProvider + ' +' + (result.failoverStoriesSaved || 0) : '') +
            '): ' + (result.errors || []).join('; ');
        } else {
          messageEl.textContent = providerId + ' update finished with errors: ' + (result.errors || []).join('; ');
        }
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = providerId + ' update failed: ' + error.message;
      } finally {
        state.busy.delete(providerId);
        await refreshData();
      }
    }

    async function resetProviderSync(providerId) {
      if (!window.confirm('Clear the stuck "running" state for ' + providerId + '? Use this only if the update is genuinely stuck — it will let you run the provider again.')) return;
      if (state.busy.has(providerId)) return;
      state.busy.add(providerId);
      renderProviders(state.providers);
      messageEl.className = 'muted';
      messageEl.textContent = 'Resetting ' + providerId + '…';
      try {
        const result = await request('/admin/api/providers/' + encodeURIComponent(providerId) + '/reset', { method: 'POST' });
        if (result.reset) {
          messageEl.className = 'success';
          messageEl.textContent = providerId + ' lock cleared — you can update it again now.';
        } else {
          messageEl.className = 'muted';
          messageEl.textContent = providerId + ' was not stuck (status: ' + (result.previousStatus || 'unknown') + ').';
        }
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = providerId + ' reset failed: ' + error.message;
      } finally {
        state.busy.delete(providerId);
        await refreshData();
      }
    }

    async function toggleHourlyAutoSync() {
      if (state.togglingAutoSync) return;
      state.togglingAutoSync = true;
      renderProviders(state.providers);
      try {
        const nextEnabled = !(state.autoSync?.enabled);
        const res = await request('/admin/api/auto-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: nextEnabled })
        });
        if (res.autoSync) state.autoSync = res.autoSync;
        renderProviders(state.providers);
        messageEl.className = 'success';
        messageEl.textContent = state.autoSync.enabled
          ? 'Hourly automatic provider querying enabled.'
          : 'Hourly automatic provider querying paused.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not update auto-sync setting: ' + error.message;
      } finally {
        state.togglingAutoSync = false;
        renderProviders(state.providers);
      }
    }

    async function syncAllProvidersNow() {
      if (state.syncingAll) return;
      state.syncingAll = true;
      renderProviders(state.providers);
      messageEl.className = 'muted';
      messageEl.textContent = 'Running full sync across all configured providers…';
      try {
        const res = await request('/admin/api/providers/sync-all', { method: 'POST' });
        if (res.autoSync) state.autoSync = res.autoSync;
        await refreshData();
        messageEl.className = res.status === 'succeeded' ? 'success' : 'muted';
        messageEl.textContent = (res.autoSync?.lastSummary || ('Synced providers: ' + (res.totalStoriesSaved || 0) + ' stories saved.'));
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Sync all providers failed: ' + error.message;
      } finally {
        state.syncingAll = false;
        renderProviders(state.providers);
      }
    }

    function renderLogFilterOptions() {
      const logProviderSelect = document.getElementById('logs-provider-filter');
      const logCategorySelect = document.getElementById('logs-category-filter');
      const logStatusNav = document.getElementById('logs-status-tabs');
      if (logProviderSelect) {
        const currentVal = state.activeLogProvider;
        logProviderSelect.replaceChildren();
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = 'All providers';
        logProviderSelect.append(allOpt);
        state.providers.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          logProviderSelect.append(opt);
        });
        logProviderSelect.value = currentVal;
      }
      if (logCategorySelect && logCategorySelect.options.length <= 1) {
        categories.forEach((cat) => {
          const opt = document.createElement('option');
          opt.value = cat.id;
          opt.textContent = cat.label;
          logCategorySelect.append(opt);
        });
        logCategorySelect.value = state.activeLogCategory;
      }
      if (logStatusNav) {
        logStatusNav.replaceChildren();
        const statusTabs = [
          { id: 'all', label: 'All' },
          { id: 'rate_limited', label: 'Rate Limited (429)' },
          { id: 'failed', label: 'Errors' },
          { id: 'failover', label: 'Failovers' },
          { id: 'succeeded', label: 'Succeeded' }
        ];
        statusTabs.forEach((tab) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'category-tab';
          btn.setAttribute('aria-pressed', String(state.activeLogStatus === tab.id));
          btn.textContent = tab.label;
          btn.addEventListener('click', () => {
            state.activeLogStatus = tab.id;
            state.pages.logs = 1;
            renderLogFilterOptions();
            renderProviderLogs();
          });
          logStatusNav.append(btn);
        });
      }
    }

    function renderProviderLogs() {
      const summaryEl = document.getElementById('logs-summary');
      const listEl = document.getElementById('provider-logs-list');
      const countEl = document.getElementById('logs-count');
      if (!listEl || !summaryEl) return;

      const summary = state.providerLogsSummary || {
        totalRequests: state.providerLogs.length,
        rateLimitedCount: 0,
        failedCount: 0,
        failoverCount: 0,
        averageLatencyMs: 0
      };
      if (countEl) {
        countEl.textContent = summary.totalRequests ? '(' + summary.totalRequests + ')' : '';
      }

      summaryEl.replaceChildren();
      [
        { label: 'Total Fetches Logged', value: String(summary.totalRequests || 0) },
        { label: 'Rate-Limit Events (429)', value: String(summary.rateLimitedCount || 0) },
        { label: 'Topic Failovers', value: String(summary.failoverCount || 0) },
        { label: 'Avg Fetch Latency', value: (summary.averageLatencyMs || 0) + ' ms' }
      ].forEach((stat) => {
        const box = document.createElement('div');
        box.className = 'log-stat-box';
        const l = document.createElement('p');
        l.className = 'log-stat-label';
        l.textContent = stat.label;
        const v = document.createElement('p');
        v.className = 'log-stat-value tabular-nums';
        v.textContent = stat.value;
        box.append(l, v);
        summaryEl.append(box);
      });

      const filtered = state.providerLogs.filter((log) => {
        if (state.activeLogProvider !== 'all' && log.provider !== state.activeLogProvider) return false;
        if (state.activeLogCategory !== 'all' && log.category !== state.activeLogCategory) return false;
        if (state.activeLogStatus !== 'all') {
          if (state.activeLogStatus === 'failover') {
            if (!log.failoverProvider && log.triggerSource !== 'failover') return false;
          } else if (log.status !== state.activeLogStatus) {
            return false;
          }
        }
        return true;
      });

      listEl.replaceChildren();
      const pager = renderPaginationBar('logs-pagination', 'logs', filtered.length, renderProviderLogs);

      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = state.providerLogs.length === 0
          ? 'No provider fetch logs recorded in this session yet. Click "Update" on a provider or "Sync all providers now" to capture detailed fetch telemetry.'
          : 'No fetch logs match the selected filters.';
        listEl.append(empty);
        return;
      }

      pager.slice(filtered).forEach((log) => {
        const row = document.createElement('article');
        row.className = 'log-row';
        const main = document.createElement('div');
        main.className = 'log-row-main';

        const left = document.createElement('div');
        left.className = 'log-row-left';

        const statusSpan = document.createElement('span');
        statusSpan.className = 'status status-' + String(log.status || 'never').toLowerCase();
        statusSpan.textContent = log.status === 'rate_limited'
          ? 'RATE LIMITED'
          : log.status === 'skipped_cooldown'
            ? 'COOLDOWN SKIP'
            : String(log.status || '').toUpperCase();

        const provSpan = document.createElement('span');
        provSpan.className = 'meta-provider';
        provSpan.textContent = log.providerLabel || log.provider;

        const catSpan = document.createElement('span');
        catSpan.className = 'meta-category';
        catSpan.textContent = '· ' + (log.category || 'all');

        const trigSpan = document.createElement('span');
        trigSpan.className = 'muted';
        trigSpan.textContent = '· trigger: ' + (log.triggerSource || 'manual');

        left.append(statusSpan, provSpan, catSpan, trigSpan);

        const right = document.createElement('div');
        right.className = 'log-row-right tabular-nums';
        const httpText = log.httpStatus ? 'HTTP ' + log.httpStatus : '—';
        const latencyText = (log.durationMs ?? 0) + 'ms';
        const retriesText = 'tries: ' + (log.attemptCount ?? 1);
        const storiesText = 'fetched: ' + (log.itemsFetched ?? 0) + ' · saved: ' + (log.storiesSaved ?? 0);
        const timeText = log.createdAt ? formatDateTime(new Date(log.createdAt)) : '';
        right.textContent = [httpText, latencyText, retriesText, storiesText, timeText].filter(Boolean).join(' · ');

        main.append(left, right);
        row.append(main);

        if (log.errorMessage) {
          const errP = document.createElement('p');
          errP.className = 'log-error-line';
          errP.textContent = log.errorMessage;
          row.append(errP);
        }

        if (state.expandedLogs.has(log.id)) {
          const drawer = document.createElement('div');
          drawer.className = 'log-drawer tabular-nums';
          const lines = [
            'Endpoint URL: ' + (log.requestUrl || '—'),
            'HTTP Status: ' + (log.httpStatus ?? '—') + ' · Latency: ' + (log.durationMs ?? 0) + ' ms · Attempts: ' + (log.attemptCount ?? 1),
            'Items Fetched: ' + (log.itemsFetched ?? 0) + ' · Stories Saved: ' + (log.storiesSaved ?? 0) + ' · Duplicates Skipped: ' + (log.duplicatesSkipped ?? 0),
            'Rate-Limit Headers: Retry-After=' + (log.retryAfterSeconds != null ? log.retryAfterSeconds + 's' : 'none') +
              ' · Remaining=' + (log.rateLimitRemaining ?? 'none') +
              ' · Reset=' + (log.rateLimitReset || 'none')
          ];
          if (log.failoverProvider) {
            lines.push('Failover Partner: ' + log.failoverProvider);
          }
          lines.forEach((lineText) => {
            const div = document.createElement('div');
            div.textContent = lineText;
            drawer.append(div);
          });
          row.append(drawer);
        }

        row.addEventListener('click', () => {
          if (state.expandedLogs.has(log.id)) state.expandedLogs.delete(log.id);
          else state.expandedLogs.add(log.id);
          renderProviderLogs();
        });

        listEl.append(row);
      });
    }

    async function refreshLogsOnly() {
      try {
        const data = await request('/admin/api/logs?limit=200');
        state.providerLogs = data.logs || [];
        state.providerLogsSummary = data.summary || state.providerLogsSummary;
        if (data.autoSync) state.autoSync = data.autoSync;
        renderProviderLogs();
        renderProviders(state.providers);
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not refresh logs: ' + error.message;
      }
    }

    async function clearAllLogs() {
      try {
        const data = await request('/admin/api/logs/clear', { method: 'POST' });
        state.providerLogs = data.logs || [];
        state.providerLogsSummary = data.summary || {
          totalRequests: 0,
          rateLimitedCount: 0,
          failedCount: 0,
          failoverCount: 0,
          averageLatencyMs: 0
        };
        state.expandedLogs.clear();
        renderProviderLogs();
        messageEl.className = 'success';
        messageEl.textContent = 'Provider fetch logs cleared.';
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Could not clear logs: ' + error.message;
      }
    }

    document.getElementById('refresh').addEventListener('click', refreshData);
    document.getElementById('refresh-logs-btn').addEventListener('click', refreshLogsOnly);
    document.getElementById('clear-logs-btn').addEventListener('click', clearAllLogs);
    document.getElementById('logs-provider-filter').addEventListener('change', (e) => {
      state.activeLogProvider = e.target.value;
      state.pages.logs = 1;
      renderProviderLogs();
    });
    document.getElementById('logs-category-filter').addEventListener('change', (e) => {
      state.activeLogCategory = e.target.value;
      state.pages.logs = 1;
      renderProviderLogs();
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
          if (state.previewType !== 'ad' && STORY_FIELD_LIMITS[field]) {
            next = next.slice(0, STORY_FIELD_LIMITS[field]);
          }
          currentValue = next;
          currentDraft[field] = next;
          if (onSave) onSave(next);
          updateVisibleDom(next);

          // Update live card elements in-place without destroying other open field editors
          const cardEl = wrapper.closest('.news-card');
          if (cardEl) {
            if (field === 'image') {
              const imgEl = cardEl.querySelector('.news-card-image');
              const wrapEl = cardEl.querySelector('.news-card-image-wrap');
              if (imgEl) {
                imgEl.classList.remove('is-loaded');
                if (wrapEl) wrapEl.classList.remove('is-loaded');
                imgEl.src = next || 'img/' + (currentDraft.category || 'all') + '_1.jpg';
              }
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
      const fallbackPreviewImg = 'img/' + (stockImages[draft.category] || stockImages.all);
      const image = document.createElement('img');
      image.className = 'news-card-image';
      image.src = draft.image || fallbackPreviewImg;
      image.alt = draft.title || '';
      attachSmoothImageLoader(image, imageWrap, fallbackPreviewImg);
      imageWrap.append(image);
      if (state.generatingImage) {
        const loadingBadge = document.createElement('div');
        loadingBadge.className = 'preview-image-loading';
        loadingBadge.textContent = '✨ Creating fun Littlables AI image…';
        imageWrap.append(loadingBadge);
      }

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
      editableField(meta, 'source', 'source name', { display: value => value || getStoryDomain(draft.link) });
      if (draft.approved === true) {
        const approval = document.createElement('span');
        approval.textContent = "🧸 Littlables' Little Scoop";
        meta.append(approval);
      }
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

      const aiActions = document.createElement('div');
      aiActions.className = 'preview-ai-actions';

      const generateSummary = document.createElement('button');
      generateSummary.type = 'button';
      generateSummary.className = 'summary-generate';
      generateSummary.textContent = state.generatingSummary ? 'Generating…' : 'Generate AI summary';
      generateSummary.disabled = state.generatingSummary || state.generatingImage;
      generateSummary.addEventListener('click', generatePreviewSummary);

      const generateImage = document.createElement('button');
      generateImage.type = 'button';
      generateImage.className = 'summary-generate image-generate';
      generateImage.textContent = state.generatingImage ? 'Generating image…' : 'Generate AI image';
      generateImage.disabled = state.generatingImage || state.generatingSummary;
      generateImage.addEventListener('click', generatePreviewImage);

      aiActions.append(generateSummary, generateImage);
      content.append(aiActions);

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

      if (state.previewStatusMessage) {
        const statusMsg = document.createElement('p');
        statusMsg.id = 'preview-status';
        statusMsg.className = 'preview-status-msg ' + (state.previewStatusType || 'muted');
        statusMsg.textContent = state.previewStatusMessage;
        preview.append(statusMsg);
      }

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

      const fallbackAdPreviewImg = 'img/' + (draft.category || 'all') + '_1.jpg';
      const imageWrap = document.createElement('div');
      imageWrap.className = 'news-card-image-wrap';
      const image = document.createElement('img');
      image.className = 'news-card-image';
      image.src = draft.img || fallbackAdPreviewImg;
      image.alt = draft.title || '';
      attachSmoothImageLoader(image, imageWrap, fallbackAdPreviewImg);
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

      if (state.previewStatusMessage) {
        const statusMsg = document.createElement('p');
        statusMsg.id = 'preview-status';
        statusMsg.className = 'preview-status-msg ' + (state.previewStatusType || 'muted');
        statusMsg.textContent = state.previewStatusMessage;
        preview.append(statusMsg);
      }

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

      const genImage = document.createElement('button');
      genImage.type = 'button';
      genImage.className = 'secondary small-btn';
      genImage.textContent = state.generatingAdImage ? 'Generating image…' : 'Generate AI image';
      genImage.disabled = !!state.generatingAdImage;
      genImage.addEventListener('click', generateAdPreviewImage);
      actions.append(genImage);

      preview.append(actions);
    }

    async function generateAdPreviewImage() {
      const draft = state.previewAdDraft;
      if (!draft || state.generatingAdImage) return;
      state.generatingAdImage = true;
      renderAdPreview();
      try {
        const result = await request('/admin/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title,
            description: draft.desc,
            category: draft.category,
            link: draft.url && draft.url !== 'https://' ? draft.url : undefined
          })
        });
        draft.img = result.image;
        state.previewStatusType = 'success';
        state.previewStatusMessage = 'AI image generated! Click Save to keep this image.';
      } catch (error) {
        state.previewStatusType = 'error';
        state.previewStatusMessage = 'Could not generate AI image: ' + error.message;
      } finally {
        state.generatingAdImage = false;
        renderAdPreview();
      }
    }

    const STORY_FIELD_LIMITS = {
      title: 500,
      description: 4000,
      content: 4000,
      aiSummary: 4000,
      source: 500
    };

    function trimStoryDraftFields(draft) {
      if (!draft || typeof draft !== 'object') return draft;
      for (const [field, maxLen] of Object.entries(STORY_FIELD_LIMITS)) {
        if (typeof draft[field] === 'string') {
          draft[field] = draft[field].trim().slice(0, maxLen);
        }
      }
      return draft;
    }

    function openStoryPreview(story) {
      state.previewType = 'story';
      state.previewStoryId = story.id ?? null;
      state.previewStatusMessage = '';
      state.previewStatusType = 'muted';
      state.previewDraft = trimStoryDraftFields({
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
      });
      renderPreview();
      lockModalScroll();
      if (!previewDialog.open) previewDialog.showModal();
      previewDialog.scrollTop = 0;
    }

    function openAdPreview(ad) {
      state.previewType = 'ad';
      state.previewAdId = ad ? ad.id : null;
      state.previewStatusMessage = '';
      state.previewStatusType = 'muted';
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
      const draft = trimStoryDraftFields(state.previewDraft);
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
          applyStoryPatchAcrossAllLists(existingId, {
            title: draft.title,
            link: draft.link,
            image: draft.image,
            description: draft.description,
            content: draft.content,
            aiSummary: draft.aiSummary,
            pubDate: draft.pubDate,
            source: draft.source,
            category: draft.category,
            updatedAt: new Date().toISOString(),
            ...(approve ? { approved: true, removed: false, decisionAction: 'approve' } : {})
          });
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
        state.previewStatusType = 'error';
        state.previewStatusMessage = 'Could not save story: ' + error.message;
        renderPreview();
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
          const res = await request('/admin/api/ads/' + encodeURIComponent(existingId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
          });
          const idx = state.ads.findIndex(a => String(a.id) === String(existingId));
          if (idx !== -1) Object.assign(state.ads[idx], res.ad || draft);
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
      if (!state.previewDraft || state.generatingSummary || state.generatingImage) return;
      trimStoryDraftFields(state.previewDraft);
      state.generatingSummary = true;
      state.previewStatusType = 'muted';
      state.previewStatusMessage = 'Generating an AI summary from the current story details…';
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
        state.previewStatusType = 'success';
        state.previewStatusMessage = 'AI summary generated. Save the card to publish it.';
        messageEl.className = 'success';
        messageEl.textContent = 'AI summary generated. Save the card to publish it.';
      } catch (error) {
        state.previewStatusType = 'error';
        state.previewStatusMessage = 'Could not generate AI summary: ' + error.message;
        messageEl.className = 'error';
        messageEl.textContent = 'Could not generate AI summary: ' + error.message;
      } finally {
        state.generatingSummary = false;
        renderPreview();
      }
    }

    async function generatePreviewImage() {
      commitAllOpenEditors();
      if (!state.previewDraft || state.generatingImage || state.generatingSummary) return;
      trimStoryDraftFields(state.previewDraft);
      state.generatingImage = true;
      state.previewStatusType = 'muted';
      state.previewStatusMessage = 'Generating a fun Littlables AI image from the story details…';
      renderPreview();
      messageEl.className = 'muted';
      messageEl.textContent = 'Generating a fun Littlables AI image from the story details…';
      try {
        const result = await request('/admin/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state.previewDraft)
        });
        state.previewDraft.image = result.image;
        state.previewStatusType = 'success';
        state.previewStatusMessage = 'AI image generated! Click Save to keep this image.';
        messageEl.className = 'success';
        messageEl.textContent = 'AI image generated. Save the card to publish it.';
      } catch (error) {
        state.previewStatusType = 'error';
        state.previewStatusMessage = 'Could not generate AI image: ' + error.message;
        messageEl.className = 'error';
        messageEl.textContent = 'Could not generate AI image: ' + error.message;
      } finally {
        state.generatingImage = false;
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

    historyProviderFilterEl.addEventListener('change', () => {
      state.activeHistoryProvider = historyProviderFilterEl.value;
      state.pages.decided = 1;
      renderStories(state.decidedStories, { decided: true });
      refreshStoryAges();
    });


    async function checkStaleHourlySync() {
      if (state.syncingAll || state.curatingAi) return;
      const syncEnabled = state.autoSync?.enabled;
      const nextMs = Date.parse(state.autoSync?.nextRunAt || '');
      const syncDue = syncEnabled && (!Number.isFinite(nextMs) || Date.now() >= nextMs);
      const aiDue = state.aiCuration?.enabled && state.aiCuration?.isSlotDue;
      if (!syncDue && !aiDue) return;
      try {
        const res = await request('/admin/api/auto-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_stale' })
        });
        if (res.triggered || res.aiTriggered) {
          await refreshData();
          if (res.aiTriggered && res.aiRun?.summaryText) {
            messageEl.className = 'success';
            messageEl.textContent = 'Scheduled AI Curation completed: ' + res.aiRun.summaryText;
          }
        } else {
          if (res.autoSync) {
            state.autoSync = res.autoSync;
            renderProviders(state.providers);
          }
          if (res.aiCuration) {
            state.aiCuration = res.aiCuration;
            renderAiStagingSection();
          }
        }
      } catch {}
    }

    /* Embedding category validation */
    const validateBtn = document.getElementById('validate-categories-btn');
    const validateStatus = document.getElementById('validate-categories-status');
    const validateResults = document.getElementById('validate-categories-results');
    if (validateBtn) {
      validateBtn.addEventListener('click', async () => {
        validateBtn.disabled = true;
        validateBtn.textContent = 'Validating…';
        if (validateStatus) validateStatus.textContent = 'Classifying stories via embeddings…';
        if (validateResults) validateResults.replaceChildren();
        try {
          const res = await fetch('/admin/api/stories/validate-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: parseInt(document.getElementById('validate-categories-limit').value, 10) || 200 }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Validation failed');
          if (validateStatus) {
            validateStatus.textContent = 'Validated ' + data.validated + ' stories, ' + data.mismatches.length + ' mismatches found.';
          }
          if (validateResults) {
            if (data.mismatches.length === 0) {
              const p = document.createElement('p');
              p.className = 'admin-hint';
              p.textContent = 'No mismatches — all validated stories match their query-assigned categories.';
              validateResults.appendChild(p);
            } else {
              const list = document.createElement('div');
              list.style.display = 'flex';
              list.style.flexDirection = 'column';
              list.style.gap = '0.5rem';
              for (const m of data.mismatches) {
                const item = document.createElement('div');
                item.className = 'admin-card';
                item.style.padding = '0.75rem';
                item.innerHTML = '<strong>Story ' + m.id + '</strong>: query=<code>' + m.queryCategory + '</code> → embedding=<code>' + m.embeddingCategory + '</code> <span class="admin-hint">(confidence ' + m.confidence + ')</span>';
                list.appendChild(item);
              }
              validateResults.appendChild(list);
            }
          }
          const countEl = document.getElementById('embedding-validation-count');
          if (countEl) countEl.textContent = data.mismatches.length ? '(' + data.mismatches.length + ' mismatches)' : '';
        } catch (err) {
          if (validateStatus) validateStatus.textContent = 'Error: ' + (err.message || 'Validation failed');
        } finally {
          validateBtn.disabled = false;
          validateBtn.textContent = 'Validate Categories';
        }
      });
    }

    restoreSectionLayout();
    refreshData();
    setInterval(refreshStoryAges, 1000);
    setInterval(() => {
      if (state.providers.some((provider) => provider.status === 'running')) refreshData();
    }, 15000);
    setInterval(checkStaleHourlySync, 60000);
  </script>
</body>
</html>`;
}
