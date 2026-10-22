-- Interest keywords: a cross-cutting keyword layer separate from display
-- categories. Stories are auto-tagged via embedding similarity (and can be
-- hand-tagged in the admin panel); custom boards are built around keywords.
-- NULL/empty = no keywords assigned.
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS interest_keywords TEXT[];

CREATE INDEX IF NOT EXISTS idx_news_stories_interest_keywords
  ON news_stories USING GIN (interest_keywords);
