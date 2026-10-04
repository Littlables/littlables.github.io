# littlables.github.io
Little snippets of current events

## Project files

- `index.html` contains the page structure and loads the app assets.
- `styles.css` contains the site styles and theme definitions.
- `i18n.js` contains the translation dictionaries and locale helpers.
- `theme.js` contains theme configuration, management, and profile sync.
- `supabase.js` contains Supabase configuration, reactions, and profile sync.
- `ai.js` calls the Cloudflare Worker for article summaries.
- `cards.js` builds news and in-feed ad cards.
- `fallback.js` renders the offline/API-error story cards.
- `app.js` contains feed loading and category logic.
- `cloudflare-worker/` contains the Workers AI summary API.
- `supabase/ai_summaries.sql` creates the persistent AI summary cache.

The early theme initializer remains in `index.html` so the saved theme is applied before the page styles load.
The JavaScript files are loaded in dependency order as classic scripts so their shared helpers are available to the app.

## AI summary setup

1. Run `supabase/ai_summaries.sql` in the Supabase SQL editor.
2. From `cloudflare-worker/`, run `npx wrangler secret put SUPABASE_SECRET_KEY`, enter your Supabase `sb_secret_...` key, then run `npx wrangler deploy`. The project URL and Workers AI and rate-limit bindings are configured in `cloudflare-worker/wrangler.toml`. The secret key must stay in Cloudflare and must never be added to the website.
3. Configure `AI_CONFIG.workerUrl` in `ai.js` if the Worker is deployed to a different URL.

Replace `sb_publishable_REPLACE_WITH_PROJECT_KEY` in `supabase.js` with the project's publishable key (`sb_publishable_...`) to enable the existing reactions and profile sync. This key is public and safe to ship to browsers. It does not replace database security: keep Row Level Security enabled on `article_reactions`, allow clients to read reaction counts, deny direct client writes to counts, and permit reaction changes only through the existing validated `increment_reaction` and `decrement_reaction` RPCs. Do not use the Worker secret key in the browser.

The Worker checks Supabase before generating a summary and saves a new summary by publisher article URL and language. For each story, it collects the main feed URL and links in the feed description, fetches Google News wrapper metadata with bounded concurrency, a short timeout, and one retry for transient rate-limit and server errors, resolves publisher URLs in one batch, fetches those publisher pages, strips common non-content HTML, and gives the extracted text to Workers AI; the model cannot browse arbitrary URLs directly. The website also limits concurrent summary requests to avoid flooding the resolver. Up to ten linked sources are supported. If some URLs fail to resolve, the Worker logs and reports those URLs while generating the summary from all successfully resolved sources; if none resolve, it returns an error. Requests and fetched pages are size-limited, redirects and private-network URLs are rejected, and a per-IP rate limit is applied. Summaries are returned as errors rather than replaced with fabricated text when generation fails.
