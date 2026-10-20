# Littlables — A Little Scoop of the World

A cozy, family-friendly news feed for curious minds, bringing together stories about family, animals, creativity, technology, world events, and uplifting news.

## Features

- **React SPA with TypeScript & Vite**: Modular, responsive component structure with high performance.
- **6 Visual Themes**: Dark, Dark Purple, Light, Rainbow, Pastel Rainbow, and Pretty Pink with local persistence and system dark/light mode detection.
- **Category Navigation**: Top Currents (all), Childcare & Family, Animals & Nature, Creative Arts, Future Tech & AI, Global Currents, and Uplifting News.
- **Category-Tailored Native Ads**: Loaded from `ads/` JSON files based on the currently selected category (`animals.json`, `childcare.json`, `arts.json`, `tech.json`, `world.json`), inserted at feed positions #2 and #5 with fallback and Google AdSense support.
- **Multilingual Support (i18n)**: 20+ localized languages (English, Marathi, Hindi, Bengali, Tamil, Telugu, Spanish, French, German, Portuguese, Italian, Chinese, Japanese, Korean, Arabic, Russian, Turkish, Indonesian, Vietnamese) with automatic browser locale and timezone detection.
- **Interactive Reactions**: Love ❤️, Mind Blown 🤯, and Cozy 🧸 reactions with live Supabase integration and offline caching.
- **AI Summary Callouts**: Formatted quick AI briefs (`✨ Quick AI Brief`) for approved and verified stories.
- **About & Disclaimer Dialogs**: Fully accessible modal dialogs for background information and transparency.

## Getting Started

### Development
```bash
npm install
npm run dev
```
The dev server runs at `http://0.0.0.0:3000`.

## Cloudflare Worker news providers

The Worker serves saved stories from Supabase; it does not call news providers on public feed requests. Provider metadata, category mappings, required credentials, and update pacing are centralized in `cloudflare-worker/src/news-provider-config.mjs`. Each adapter in `cloudflare-worker/src/feeds/` owns its provider request and response parsing. Shared timeouts, bounded retries, response-size limits, URL validation, and story normalization are in `cloudflare-worker/src/feed-utils.mjs`.

Configured providers are GNews, Bing News, NewsData.io, TheNewsAPI.com, WorldNewsAPI, and Reddit RSS. Configure the API keys for the providers you use from `cloudflare-worker/`:

```bash
npx wrangler secret put GNEWS_API_KEY
npx wrangler secret put NEWSDATA_API_KEY
npx wrangler secret put THENEWSAPI_API_KEY
npx wrangler secret put WORLDNEWSAPI_API_KEY
```

Bing News and Reddit RSS do not require API keys. Reddit uses public subreddit Atom/RSS feeds and has a longer request pause/retry backoff to respect its tighter unauthenticated rate limits. The admin dashboard reports whether each required secret is configured and disables provider updates when credentials are missing. Updates pause between topic requests and retry transient failures; run providers independently to avoid sharing provider quotas. Add a provider by defining its metadata and topic mapping, implementing an adapter, registering it in `news-feeds.mjs`, then adding adapter tests.

### Production Build
```bash
npm run build
npm run preview
```

### GitHub Actions Deployment (Pages + Cloudflare Worker)

`.github/workflows/deploy.yml` deploys the frontend to GitHub Pages and automatically tests and deploys the Cloudflare Worker (`cloudflare-worker/`) **only when files in `cloudflare-worker/`, `ads/`, or `scripts/export_ads.py` have changed** (or when manually triggered via `workflow_dispatch` with `deploy_worker: true`).

Configure the following GitHub Actions repository secrets for Worker deployment:
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with **Edit Cloudflare Workers** permissions.
- `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare Account ID.
- `WRANGLER_TOML` *(optional)* — Custom `wrangler.toml` contents if not using `cloudflare-worker/wrangler.example.toml`.

