-- Frontend category overrides (admin-curated).
-- display_categories is the list of categories a story should appear under on
-- the frontend. NULL (or empty) means "no override" — the story shows under
-- its query-assigned `category` as before.
-- Setting it replaces the display category (use for AI-category overrides),
-- and listing several categories shows the story in each of them.

ALTER TABLE public.news_stories
  ADD COLUMN IF NOT EXISTS display_categories TEXT[];

-- Index for finding stories overridden into a given category
CREATE INDEX IF NOT EXISTS idx_news_stories_display_categories
  ON public.news_stories USING GIN (display_categories);
