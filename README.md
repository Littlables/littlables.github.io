# littlables.github.io
Little snippets of current events

## Project files

- `index.html` contains the page structure and loads the app assets.
- `styles.css` contains the site styles and theme definitions.
- `i18n.js` contains the translation dictionaries and locale helpers.
- `theme.js` contains theme configuration, management, and profile sync.
- `supabase.js` contains Supabase configuration, reactions, and profile sync.
- `cards.js` builds news and in-feed ad cards.
- `fallback.js` renders the offline/API-error story cards.
- `app.js` contains feed loading and category logic.
- `cloudflare-worker/` contains the news API, ingestion service, and authenticated admin tools.
- `cloudflare-worker/src/news-feeds.mjs` defines feed providers and normalizes their article data.
- `cloudflare-worker/src/news-storage.mjs` persists and serves provider stories through Supabase.
- `cloudflare-worker/src/admin-page.mjs` serves the GitHub-authenticated ingestion dashboard and editable story previews.

The early theme initializer remains in `index.html` so the saved theme is applied before the page styles load.
The JavaScript files are loaded in dependency order as classic scripts so their shared helpers are available to the app. The app requests saved stories by category from the Worker; provider configuration and article normalization live in `cloudflare-worker/src/news-feeds.mjs`.

## Local development

Open the workspace in VS Code, select **Run and Debug**, then start **Launch Chrome against localhost**. The launch configuration starts the Python static server on port 8000 before opening the site. Python 3 must be available on `PATH`; in a remote workspace, forward port 8000 if VS Code does not do so automatically.

## AI summaries

Workers AI is bound in `cloudflare-worker/wrangler.toml`. From an authenticated admin story preview, choose **Generate AI summary** to create a summary from the current title, source, description, content, and article URL. The Worker uses Cloudflare's `@cf/meta/llama-3.2-3b-instruct` model and attempts to read the publisher page, but can still use the edited story details if the publisher blocks automated access. Save the preview to store the summary on its story record. The public site displays only a generated and saved summary; it does not call the AI endpoint.

Replace `sb_publishable_REPLACE_WITH_PROJECT_KEY` in `supabase.js` with the project's publishable key (`sb_publishable_...`) to enable the existing reactions and profile sync. This key is public and safe to ship to browsers. It does not replace database security: keep Row Level Security enabled on `article_reactions`, allow clients to read reaction counts, deny direct client writes to counts, and permit reaction changes only through the existing validated `increment_reaction` and `decrement_reaction` RPCs. Do not use the Worker secret key in the browser.

The Worker serves saved stories and images from Supabase; it no longer calls a news API for each public feed request. GNews and Bing News are the configured ingestion providers. GNews authenticates through the `X-Api-Key` header using the `GNEWS_API_KEY` Worker secret. Provider endpoints, per-category queries, and response normalization live in `cloudflare-worker/src/news-feeds.mjs`. Summary generation is restricted to the authenticated admin preview, rate-limited, and uses the latest edited story fields. A summary is saved with the story and appears publicly only after it has been generated and saved. Requests and fetched pages are size-limited, redirects and private-network URLs are rejected.

## Provider ingestion and admin

Run or re-run `supabase/news_ingestion.sql` in the Supabase SQL editor before deploying; it adds any missing story fields, including the saved AI summary column. New stories default to `approved = false`; the public feed shows approved stories first, then unapproved stories, while banned stories remain hidden. Newly fetched stories appear in the admin approval queue. **Approve** publishes a story with the Littlables badge; **Disapprove** keeps it in the feed without the badge; **Ban** hides it from the site. Ban is a soft removal: the row and its unique provider/category/article URL key remain in the database, so later ingestion updates that row rather than creating a duplicate. Clicking any admin story opens its editable homepage-style preview. Custom previews can be added directly as approved stories. The admin's last ten decided stories include an **Undo** action. **Ignore** only hides an item until the page reloads. Deploy the Worker after configuring `SUPABASE_SECRET_KEY` and `GNEWS_API_KEY`. Run each provider's update from `/admin` to populate the tables. Each provider button fetches its categories with short pauses and bounded retries for transient upstream errors. Different providers can update concurrently; a database-backed lock prevents overlapping updates to the same provider. Stories are upserted by provider, category, and publisher URL, without resetting existing approval or ban decisions. Provider status shows both the latest-run count and the provider's current total story count.

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
