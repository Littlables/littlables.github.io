-- Embedding-based category validation (prototype).
-- Stores the classifier's predicted category alongside the query-assigned category
-- so mismatches can be flagged for review in the admin panel.

ALTER TABLE public.news_stories
  ADD COLUMN IF NOT EXISTS embedding_category TEXT;

ALTER TABLE public.news_stories
  ADD COLUMN IF NOT EXISTS embedding_confidence NUMERIC;

-- Index for finding mismatches efficiently
CREATE INDEX IF NOT EXISTS idx_news_stories_embedding_mismatch
  ON public.news_stories (embedding_category)
  WHERE embedding_category IS NOT NULL AND embedding_category <> category;
