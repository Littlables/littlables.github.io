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
- `cloudflare-worker/src/news-feeds.mjs` defines feed providers and normalizes their article data.
- `cloudflare-worker/src/news-storage.mjs` persists and serves provider stories through Supabase.
- `cloudflare-worker/src/admin-page.mjs` serves the GitHub-authenticated ingestion dashboard.
- `supabase/ai_summaries.sql` creates the persistent AI summary cache.

The early theme initializer remains in `index.html` so the saved theme is applied before the page styles load.
The JavaScript files are loaded in dependency order as classic scripts so their shared helpers are available to the app. The app requests saved stories by category from the Worker; provider configuration and article normalization live in `cloudflare-worker/src/news-feeds.mjs`.

## Local development

Open the workspace in VS Code, select **Run and Debug**, then start **Launch Chrome against localhost**. The launch configuration starts the Python static server on port 8000 before opening the site. Python 3 must be available on `PATH`; in a remote workspace, forward port 8000 if VS Code does not do so automatically.

## AI summary setup

1. Run `supabase/ai_summaries.sql` in the Supabase SQL editor.
2. From `cloudflare-worker/`, run `npx wrangler secret put SUPABASE_SECRET_KEY` and enter your Supabase `sb_secret_...` key. Set the GNews key with `npx wrangler secret put GNEWS_API_KEY`. Configure the GitHub OAuth secrets as described below, then run `npx wrangler deploy`. The project URL and Workers AI and rate-limit bindings are configured in `cloudflare-worker/wrangler.toml`. Keep all secrets in Cloudflare; never add them to the website.
3. Configure `AI_CONFIG.workerUrl` in `ai.js` if the Worker is deployed to a different URL.

Replace `sb_publishable_REPLACE_WITH_PROJECT_KEY` in `supabase.js` with the project's publishable key (`sb_publishable_...`) to enable the existing reactions and profile sync. This key is public and safe to ship to browsers. It does not replace database security: keep Row Level Security enabled on `article_reactions`, allow clients to read reaction counts, deny direct client writes to counts, and permit reaction changes only through the existing validated `increment_reaction` and `decrement_reaction` RPCs. Do not use the Worker secret key in the browser.

The Worker serves saved stories and images from Supabase; it no longer calls a news API for each public feed request. GNews and Bing News are the configured ingestion providers. GNews authenticates through the `X-Api-Key` header using the `GNEWS_API_KEY` Worker secret. Provider endpoints, per-category queries, and response normalization live in `cloudflare-worker/src/news-feeds.mjs`. GNews article descriptions and available content are stored and supplied to the AI summary request, with readable publisher-page text preferred and stored feed text used when publishers block scraping. The Worker checks Supabase before generating a summary and saves it by publisher article URL and language. The model cannot browse arbitrary URLs directly. Up to ten linked sources are supported. If some URLs fail to resolve, the Worker logs and reports those URLs while generating the summary from all successfully resolved sources; if none resolve, it returns an error. Requests and fetched pages are size-limited, redirects and private-network URLs are rejected, and a per-IP rate limit is applied. Summaries are returned as errors rather than replaced with fabricated text when generation fails.

## Provider ingestion and admin

Run `supabase/news_ingestion.sql` in the Supabase SQL editor before deploying. New and previously stored stories default to `approved = false`; existing feed records therefore need approval before becoming visible. Deploy the Worker after configuring `SUPABASE_SECRET_KEY` and `GNEWS_API_KEY`. The public `GET /feed?category=<category>` endpoint reads only approved stories from Supabase instead of querying a news provider on every browser visit. Run each provider's update from `/admin` to populate the tables before expecting stories in the public feed. Newly fetched stories appear in the admin approval queue. Approving a story records its status, the admin identity, and the approval time. Each provider button fetches its categories with short pauses and bounded retries for transient upstream errors. Different providers can update concurrently; a database-backed lock prevents overlapping updates to the same provider. Stories are upserted by provider, category, and publisher URL, so repeated updates refresh existing rows rather than creating duplicates or resetting earlier approvals.

### GitHub admin sign-in

Create a GitHub OAuth App under **GitHub → Settings → Developer settings → OAuth Apps**. Set its homepage URL to the site and its callback URL to the exact value of `GITHUB_OAUTH_CALLBACK_URL` in `cloudflare-worker/wrangler.toml` (by default, `https://hello-ai.cryptokatiee.workers.dev/admin/auth/callback`). Then, from `cloudflare-worker/`, configure its credentials and the single allowed GitHub username:

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GITHUB_SESSION_SECRET
```

Use the OAuth App's client ID and client secret for the first two prompts. Generate a long random session secret for the third (for example, `openssl rand -base64 48`). Change `GITHUB_ALLOWED_USER` in `wrangler.toml` to your exact GitHub username; the configured account is the only one allowed to sign in. If you use a custom Worker domain, update the callback URL in `wrangler.toml` and in the GitHub OAuth App to match exactly.

For local Worker testing, create a separate GitHub OAuth App whose callback points to your local Wrangler URL, update the local callback setting, and provide its credentials through `cloudflare-worker/.dev.vars` (do not commit that file). It should contain `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_SESSION_SECRET`, each on its own `NAME=value` line. The `.dev.vars*` pattern is ignored by Git. A GitHub OAuth App has one callback URL, so reusing the production app for local and production testing may not work.

After applying the SQL, configuring the secrets, and deploying the Worker, open `https://hello-ai.cryptokatiee.workers.dev/admin` and choose **Continue with GitHub**. The Worker checks the GitHub account on OAuth callback and creates a signed, HttpOnly, seven-day session cookie. The dashboard shows provider status, last successful update, the unapproved story queue, total saved records, and the latest ten distinct stories. Signing out clears the session cookie.
