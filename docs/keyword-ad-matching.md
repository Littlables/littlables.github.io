# Keyword-Based Ad Matching — Design (branch: keyword-ad-matching)

Status: Groundwork only. Matcher logic + tests exist; not wired into feeds yet.

## Goal
Show ads next to stories based on shared interest keywords, so a dinosaur
story shows dinosaur toy ads instead of whatever the category rotation picks.

## How it works

1. **Ads get `keywords`** — array of interest keyword ids (e.g. `["dinosaurs", "toys"]`).
   - JSON ads: new optional `keywords` field.
   - Awin products: derive from product title/category via the same classifier,
     or hand-tag top products. (Decide later.)
   - Worker `ads-data.mjs`: ad objects pass `keywords` through.

2. **Matching** — `cloudflare-worker/src/ad-keyword-matcher.mjs` (pure logic):
   - `scoreAdForStory(storyKeywords, ad)`: 10 pts per overlapping keyword.
   - Excluded ("Flagged") keywords never match on either side.
   - Ads with no `keywords` fall back to today's category matching (score 1),
     so untagged ads keep working during migration.

3. **Serving** (not built yet):
   - `GET /feed` (or frontend): after fetching stories, call
     `matchAdsToStory(story, candidateAds)` per story and attach top N ads.
   - Subrequest budget: matching is pure CPU (no I/O) — free.
   - Tagging ads is the real work: 70 Amazon + ~150 Gumroad/TikTok + 797 Awin.

## Open questions (for later)
- Who tags the ads? Options: (a) Katie hand-tags in admin panel (new UI),
  (b) auto-tag via embedding classifier on ad title+desc (cheap, reuse vectors),
  (c) LLM tag on import. Recommend (b) with hand-correction.
- How many ads per story? Where in the layout? (Frontend work.)
- Should matching consider the story's *category* as a tiebreak?
- Awin sync: tag products at sync time and store keywords in Supabase.

## Files
- `cloudflare-worker/src/ad-keyword-matcher.mjs` — scoring + ranking
- `cloudflare-worker/src/ad-keyword-matcher.test.mjs` — 5 tests
- `src/types/index.ts` — `AdItem.keywords?: string[]`
