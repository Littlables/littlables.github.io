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
    a { color: #a5b4fc; }
    #stories { display: grid; gap: .75rem; }
    #pending-stories { display: grid; gap: .75rem; }
    .story { display: grid; grid-template-columns: 72px 1fr; align-items: center; }
    .story-main { display: flex; align-items: center; gap: 1rem; }
    .story img { width: 72px; height: 56px; object-fit: cover; border-radius: 6px; }
    .story h3 { font-size: 1rem; margin: 0 0 .25rem; }
    .story p { margin: 0; color: #cbd5e1; font-size: .85rem; }
    .error { color: #fca5a5 !important; }
    .success { color: #86efac !important; }
    @media (max-width: 520px) { .toolbar, .provider-head { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <header class="toolbar">
    <div><h1>Littlables news admin</h1><p id="identity" class="muted">Verifying GitHub session…</p></div>
    <button id="refresh" type="button">Refresh data</button>
    <button id="logout" type="button">Sign out</button>
  </header>
  <section aria-labelledby="providers-title">
    <h2 id="providers-title">News providers</h2>
    <div id="providers" class="providers" aria-live="polite"></div>
  </section>
  <section aria-labelledby="pending-title">
    <h2 id="pending-title">Stories awaiting approval <span id="pending-count"></span></h2>
    <div id="pending-stories" aria-live="polite"></div>
  </section>
  <section class="summary" aria-live="polite">
    <h2>Saved story records: <span id="total">—</span></h2>
    <p id="message" class="muted">Loading database status…</p>
  </section>
  <section aria-labelledby="stories-title">
    <h2 id="stories-title">Last 10 saved stories</h2>
    <div id="stories"></div>
  </section>
  <script>
    const state = { busy: new Set(), approving: new Set(), providers: [], pendingStories: [] };
    const providersEl = document.getElementById('providers');
    const messageEl = document.getElementById('message');
    const text = (value) => value == null || value === '' ? '—' : String(value);
    const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Never';

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
        status.textContent = 'Status: ' + text(provider.status);
        const updated = document.createElement('p');
        updated.textContent = 'Last updated: ' + formatDate(provider.last_success_at);
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

    function renderStories(stories, { pending = false } = {}) {
      const container = document.getElementById(pending ? 'pending-stories' : 'stories');
      container.replaceChildren();
      stories.forEach((story) => {
        const row = document.createElement('article');
        row.className = 'story';
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
        const details = document.createElement('div');
        const title = document.createElement('h3');
        const link = document.createElement('a');
        link.href = story.link;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = story.title;
        title.append(link);
        const meta = document.createElement('p');
        meta.textContent = [story.provider, story.category, formatDate(story.pubDate)].join(' · ');
        details.append(title, meta);
        const main = document.createElement('div');
        main.className = 'story-main';
        main.append(details);
        row.append(main);
        if (pending) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = state.approving.has(story.id) ? 'Approving…' : 'Approve';
          button.disabled = state.approving.has(story.id);
          button.addEventListener('click', () => approveStory(story.id));
          row.append(button);
        }
        container.append(row);
      });
      if (!stories.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No stories have been saved yet.';
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
        renderProviders(data.providers);
        document.getElementById('total').textContent = data.totalStories.toLocaleString();
        document.getElementById('pending-count').textContent = state.pendingStories.length
          ? '(' + state.pendingStories.length + (state.pendingStories.length === 100 ? '+' : '') + ')'
          : '';
        renderStories(state.pendingStories, { pending: true });
        renderStories(data.recentStories);
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
        messageEl.className = 'success';
        messageEl.textContent = 'Story approved and published.';
        await refreshData();
      } catch (error) {
        messageEl.className = 'error';
        messageEl.textContent = 'Story approval failed: ' + error.message;
      } finally {
        state.approving.delete(storyId);
      }
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
    setInterval(() => {
      if (state.providers.some((provider) => provider.status === 'running')) refreshData();
    }, 15000);
  </script>
</body>
</html>`;
}
