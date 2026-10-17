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
    h1, h2 { line-height: 1.2; }
    .toolbar, .provider-head, .story { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .provider, .story, .summary { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1rem; }
    .provider h2 { font-size: 1.1rem; margin: 0; }
    .provider p, .muted { color: #cbd5e1; }
    button { border: 0; border-radius: 8px; padding: .65rem 1rem; font: inherit; font-weight: 700; color: white; background: #4f46e5; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    button.secondary { background: #475569; }
    .section-toggle { padding: 0; background: transparent; text-align: left; }
    a { color: #a5b4fc; }
    #stories, #pending-stories, #banned-stories { display: grid; gap: .75rem; }
    #stories[hidden], #banned-stories[hidden] { display: none; }
    .story { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; align-items: center; gap: 1rem; cursor: pointer; }
    .story:focus-visible { outline: 2px solid #a5b4fc; outline-offset: 2px; }
    .story-main, .story-details { min-width: 0; }
    .story img { width: 72px; height: 56px; object-fit: cover; border-radius: 6px; }
    .story h3 { font-size: 1rem; margin: 0 0 .4rem; overflow-wrap: anywhere; }
    .story-meta { display: flex; flex-wrap: wrap; gap: .4rem; }
    .story-meta span { font-size: .8rem; font-weight: 650; }
    .meta-provider { color: #c4b5fd; }
    .meta-domain { color: #fcd34d; }
    .meta-category { color: #7dd3fc; }
    .meta-date { color: #86efac; }
    .decision-note { margin: .4rem 0 0; color: #cbd5e1; font-size: .82rem; }
    .story-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
    .story-actions button { white-space: nowrap; }
    .custom-input { box-sizing: border-box; width: 100%; padding: .8rem 1rem; border: 1px solid #475569; border-radius: 8px; background: #0f172a; color: #f8fafc; font: inherit; }
    .preview-dialog { width: min(92vw, 460px); max-height: 92vh; overflow: auto; color: #f8fafc; background: #0b0f19; border: 1px solid #475569; border-radius: 14px; }
    .preview-dialog::backdrop { background: rgb(2 6 23 / 75%); }
    .news-card { overflow: hidden; display: flex; flex-direction: column; background: #1e293b; border: 1px solid #334155; border-radius: 14px; box-shadow: 0 4px 15px rgb(0 0 0 / 25%); }
    .news-card-image-wrap { position: relative; width: 100%; height: 190px; overflow: hidden; background: #334155; }
    .news-card-image { display: block; width: 100%; height: 100%; object-fit: cover; }
    .news-card-badge { position: absolute; top: .75rem; left: .75rem; padding: .25rem .6rem; border-radius: 6px; background: #4f46e5; color: white; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
    .news-card-content { display: flex; flex: 1; flex-direction: column; gap: .75rem; padding: 1.25rem; }
    .news-card-meta { display: flex; justify-content: space-between; gap: .5rem; color: #cbd5e1; font-size: .75rem; }
    .news-card-title { color: #f8fafc; font-size: 1.1rem; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; text-decoration: none; }
    .news-card-title:hover { color: #a5b4fc; text-decoration: none; }
    .news-card-desc { flex: 1; color: #cbd5e1; font-size: .85rem; line-height: 1.5; }
    .news-card-ai-summary { padding: .65rem .85rem; border-left: 3px solid #818cf8; border-radius: 0 8px 8px 0; background: #172554; color: #e0e7ff; font-size: .8rem; line-height: 1.45; }
    .news-card-ai-label { margin-bottom: .25rem; color: #c7d2fe; font-size: .68rem; font-weight: 800; text-transform: uppercase; }
    .news-card-footer { display: flex; justify-content: space-between; align-items: center; gap: .5rem; flex-wrap: wrap; margin-top: auto; padding-top: .65rem; border-top: 1px solid rgb(255 255 255 / 5%); }
    .news-read-more-btn { color: #a5b4fc; font-size: .85rem; font-weight: 600; text-decoration: none; }
    .news-card-reactions { display: flex; gap: .4rem; }
    .preview-reaction { padding: .25rem .45rem; border: 1px solid #475569; border-radius: 999px; color: white; background: #334155; font-size: .75rem; }
    .preview-editable { display: inline-flex; align-items: flex-start; gap: .35rem; min-width: 0; }
    .preview-edit { flex: 0 0 auto; padding: .1rem .25rem; background: transparent; font-size: .9rem; line-height: 1; }
    .preview-value { min-width: 0; overflow-wrap: anywhere; }
    .preview-inline-editor { display: flex; flex: 1 1 100%; gap: .4rem; margin-top: .35rem; }
    .preview-inline-editor input, .preview-inline-editor textarea, .preview-inline-editor select { box-sizing: border-box; width: 100%; min-width: 0; padding: .45rem; border: 1px solid #64748b; border-radius: 6px; background: #0f172a; color: #f8fafc; font: inherit; }
    .preview-inline-editor textarea { min-height: 5rem; resize: vertical; }
    .preview-inline-editor button { padding: .35rem .55rem; }
    .preview-image-edit { position: absolute; top: .6rem; right: .6rem; }
    .preview-meta .preview-editable { flex-wrap: wrap; }
    .preview-category-edit { position: absolute; top: .75rem; left: .75rem; }
    .preview-category-edit .news-card-badge { position: static; }
    .preview-actions { display: flex; justify-content: space-between; gap: .5rem; padding-top: 1rem; }
    .preview-actions .secondary { background: #475569; }
    .preview-context { color: #cbd5e1; font-size: .85rem; }
    .preview-card button { color: white; }
    .preview-card .preview-edit { color: white; }
    .preview-dialog > .preview-close { display: block; margin: 1rem 0 0 auto; }
    .category-tabs { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    .category-tab { padding: .5rem .75rem; background: #334155; }
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
      .story { grid-template-columns: 56px minmax(0, 1fr); gap: .75rem; }
      .story img { width: 56px; height: 48px; }
      .story-actions { grid-column: 2; justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <div><h1>Littlables news admin</h1><p id="identity" class="muted">Verifying GitHub session…</p></div>
    <button id="refresh" type="button">Refresh data</button>
    <button id="logout" type="button">Sign out</button>
  </header>
  <section class="summary" aria-live="polite">
    <h2>Saved story records: <span id="total">—</span></h2>
    <p id="message" class="muted">Loading database status…</p>
  </section>
  <section aria-labelledby="custom-title">
    <h2 id="custom-title">Custom</h2>
    <input id="custom-link" class="custom-input" type="url" placeholder="Paste an article link to preview its card" aria-label="Paste an article link to preview its card">
  </section>
  <dialog id="preview-dialog" class="preview-dialog" aria-labelledby="preview-title">
    <div id="preview-card"></div>
    <button id="preview-close" class="preview-close secondary" type="button">Close preview</button>
  </dialog>
  <section aria-labelledby="providers-title">
    <h2 id="providers-title">News providers</h2>
    <div id="providers" class="providers" aria-live="polite"></div>
  </section>
  <section aria-labelledby="pending-title">
    <h2 id="pending-title">Stories awaiting approval <span id="pending-count"></span></h2>
    <nav id="approval-categories" class="category-tabs" aria-label="Filter pending stories by category"></nav>
    <div id="pending-stories" aria-live="polite"></div>
  </section>
  <section aria-labelledby="stories-title">
    <h2 id="stories-title">
      <button id="decisions-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="stories">
        <span id="decisions-arrow" aria-hidden="true">▼</span> Last 10 decided-on stories
      </button>
    </h2>
    <div id="stories" hidden></div>
  </section>
  <section aria-labelledby="banned-title">
    <h2 id="banned-title">
      <button id="banned-toggle" class="section-toggle" type="button" aria-expanded="false" aria-controls="banned-stories">
        <span id="banned-arrow" aria-hidden="true">▼</span> Banned stories
      </button>
    </h2>
    <div id="banned-stories" hidden></div>
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
      previewDraft: null,
      previewStoryId: null,
      activeCategory: 'all',
      providers: [],
      pendingStories: [],
      decidedStories: [],
      bannedStories: []
    };
    const providersEl = document.getElementById('providers');
    const messageEl = document.getElementById('message');
    const categoryEl = document.getElementById('approval-categories');
    const text = (value) => value == null || value === '' ? '—' : String(value);
    const formatDateTime = (date) => date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

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
        button.textContent = state.busy.has(provider.id) ? 'Updating…' : 'Update now';
        button.disabled = state.busy.has(provider.id) || provider.status === 'running';
        button.addEventListener('click', () => updateProvider(provider.id));
        head.append(title, button);
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
        card.append(head, status, updated, saved);
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

    function renderStories(stories, { pending = false, decided = false, banned = false } = {}) {
      const container = document.getElementById(pending ? 'pending-stories' : banned ? 'banned-stories' : 'stories');
      container.replaceChildren();
      const visibleStories = pending
        ? stories.filter((story) =>
          !state.ignored.has(story.id) &&
          (state.activeCategory === 'all' || story.category === state.activeCategory))
        : stories;
      visibleStories.forEach((story) => {
        const row = document.createElement('article');
        row.className = 'story';
        row.tabIndex = 0;
        row.setAttribute('aria-label', 'Edit story: ' + story.title);
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
          row.append(image);
        } else {
          const spacer = document.createElement('span');
          row.append(spacer);
        }
        const title = document.createElement('h3');
        const link = document.createElement('a');
        link.href = story.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = story.title;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openStoryPreview(story);
        });
        title.append(link);
        const meta = document.createElement('p');
        meta.className = 'story-meta';
        [
          ['meta-provider', story.provider],
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
        if (pending || decided || banned) {
          const actions = document.createElement('div');
          actions.className = 'story-actions';
          if (pending) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = state.approving.has(story.id) ? 'Approving…' : 'Approve';
            button.disabled = state.approving.has(story.id);
            button.addEventListener('click', () => approveStory(story.id));
            const disapproveButton = document.createElement('button');
            disapproveButton.type = 'button';
            disapproveButton.className = 'secondary';
            disapproveButton.textContent = state.unapproving.has(story.id) ? 'Disapproving…' : 'Disapprove';
            disapproveButton.disabled = state.unapproving.has(story.id);
            disapproveButton.addEventListener('click', () => disapproveStory(story.id));
            const ignoreButton = document.createElement('button');
            ignoreButton.type = 'button';
            ignoreButton.className = 'secondary';
            ignoreButton.textContent = 'Ignore';
            ignoreButton.addEventListener('click', () => {
              state.ignored.add(story.id);
              renderStories(state.pendingStories, { pending: true });
            });
            const banButton = document.createElement('button');
            banButton.type = 'button';
            banButton.className = 'secondary';
            banButton.textContent = state.banning.has(story.id) ? 'Banning…' : 'Ban';
            banButton.disabled = state.banning.has(story.id);
            banButton.addEventListener('click', () => banStory(story.id));
            actions.append(button, disapproveButton, ignoreButton, banButton);
          } else if (story.approved && !story.removed) {
            const disapproveButton = document.createElement('button');
            disapproveButton.type = 'button';
            disapproveButton.className = 'secondary';
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
            undoButton.className = 'secondary';
            undoButton.textContent = 'Undo';
            undoButton.addEventListener('click', () => undoDecision(story.id));
            actions.append(undoButton);
          } else if ((decided || banned) && state.undoing.has(story.id)) {
            const undoButton = document.createElement('button');
            undoButton.type = 'button';
            undoButton.className = 'secondary';
            undoButton.textContent = 'Undoing…';
            undoButton.disabled = true;
            actions.append(undoButton);
          }
          row.append(actions);
        }
        container.append(row);
      });
      if (!visibleStories.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = pending && state.activeCategory !== 'all'
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

    async function refreshData() {
      messageEl.className = 'muted';
      messageEl.textContent = 'Refreshing database status…';
      try {
        const data = await request('/admin/api/status');
        state.providers = data.providers;
        state.pendingStories = data.pendingStories || [];
        state.decidedStories = data.recentStories || [];
        state.bannedStories = data.bannedStories || [];
        renderProviders(data.providers);
        document.getElementById('total').textContent = data.totalStories.toLocaleString();
        document.getElementById('pending-count').textContent = state.pendingStories.length
          ? '(' + state.pendingStories.length + (state.pendingStories.length === 100 ? '+' : '') + ')'
          : '';
        renderCategoryTabs();
        renderStories(state.pendingStories, { pending: true });
        renderStories(state.decidedStories, { decided: true });
        renderStories(state.bannedStories, { banned: true });
        refreshStoryAges();
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

    function editableField(parent, field, label, {
      tag = 'span',
      value = state.previewDraft[field] || '',
      editor = 'text',
      className = '',
      display = value => value || 'Not set'
    } = {}) {
      const wrapper = document.createElement('span');
      wrapper.className = 'preview-editable ' + className;
      const visible = document.createElement(tag);
      visible.className = 'preview-value';
      if (field === 'title') visible.classList.add('news-card-title');
      const displayValue = display(value);
      if (displayValue instanceof Node) visible.append(displayValue);
      else visible.textContent = displayValue;
      if (tag === 'a') {
        visible.href = state.previewDraft.link;
        visible.target = '_blank';
        visible.rel = 'noopener noreferrer';
      }
      const pencil = editButton(label);
      pencil.addEventListener('click', () => {
        pencil.hidden = true;
        const editorWrap = document.createElement('span');
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
          input.value = value;
        } else if (editor === 'textarea') {
          input = document.createElement('textarea');
          input.value = value;
        } else {
          input = document.createElement('input');
          input.type = editor;
          input.value = editor === 'datetime-local' && value
            ? (() => {
              const date = new Date(value);
              date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
              return date.toISOString().slice(0, 16);
            })()
            : value;
        }
        input.setAttribute('aria-label', label);
        const done = document.createElement('button');
        done.type = 'button';
        done.textContent = 'Done';
        done.addEventListener('click', () => {
          let next = input.value.trim();
          if (editor === 'datetime-local' && next) next = new Date(next).toISOString();
          state.previewDraft[field] = next;
          renderPreview();
        });
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'secondary';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => renderPreview());
        editorWrap.append(input, done, cancel);
        wrapper.append(editorWrap);
        input.focus();
      });
      wrapper.append(visible, pencil);
      parent.append(wrapper);
      return wrapper;
    }

    function renderPreview() {
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
        childcare: 'animals_1.jpg',
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
      image.onerror = () => { image.hidden = true; };
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
        ? new Date(draft.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Recent';
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
      aiSummary.className = 'news-card-ai-summary';
      const aiLabel = document.createElement('div');
      aiLabel.className = 'news-card-ai-label';
      aiLabel.textContent = 'A little AI brief';
      aiSummary.append(aiLabel);
      editableField(aiSummary, 'aiSummary', 'AI summary', {
        editor: 'textarea',
        display: value => value || 'A summary will be generated from the story details on the homepage.'
      });
      content.append(aiSummary);

      const footer = document.createElement('div');
      footer.className = 'news-card-footer';
      const readMore = document.createElement('a');
      readMore.className = 'news-read-more-btn';
      readMore.href = draft.link;
      readMore.target = '_blank';
      readMore.rel = 'noopener noreferrer';
      readMore.textContent = 'Read Full Story →';
      footer.append(readMore);
      const reactions = document.createElement('div');
      reactions.className = 'news-card-reactions';
      ['❤️ 0', '🤯 0', '🧸 0'].forEach((reaction) => {
        const pill = document.createElement('span');
        pill.className = 'preview-reaction';
        pill.textContent = reaction;
        reactions.append(pill);
      });
      footer.append(reactions);
      editableField(footer, 'link', 'article URL', {
        tag: 'span',
        editor: 'url',
        display: () => '✏️ URL'
      });
      card.append(imageWrap, content);
      preview.append(card);

      const context = document.createElement('p');
      context.className = 'preview-context';
      context.textContent = 'AI summary source content';
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

    function openStoryPreview(story) {
      state.previewStoryId = story.id ?? null;
      state.previewDraft = {
        title: story.title || '',
        link: story.link || '',
        image: story.image || '',
        description: story.description || '',
        content: story.content || '',
        aiSummary: story.aiSummary || '',
        pubDate: story.pubDate || '',
        source: story.source || '',
        category: story.category || 'all',
        approved: story.approved === true,
        removed: story.removed === true
      };
      renderPreview();
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
    refreshData();
    setInterval(refreshStoryAges, 1000);
    setInterval(() => {
      if (state.providers.some((provider) => provider.status === 'running')) refreshData();
    }, 15000);
  </script>
</body>
</html>`;
}
