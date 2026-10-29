-- Backfill publish dates for the approved Halloween batch (option B).
--
-- The batch rows were staged with no publish date, so feeds order them
-- last (newest-first with dateless last) and the all feed never includes
-- them (its per-category slots fill with dated stories first). Giving
-- them today's date moves them into visible placement.
--
-- Scope: only dateless rows from the Halloween batch. Approval status,
-- categories, keywords, and every other story are untouched, and the
-- update is idempotent (re-running changes nothing once dates are set).
--
-- Deliberately excluded: the three stories cut from the batch, which
-- stay dateless until their leave-live-or-pull decision is made.
UPDATE public.news_stories
SET published_at = '2026-10-29 12:00:00+00'
WHERE provider = 'halloween-batch'
  AND published_at IS NULL
  AND title NOT IN (
    'Knott''s Spooky Farm 2026: Guide for Families',
    'Boo at the Zoo — Santa Barbara',
    'Stage Fright: A Halloween Family Festival at Klyde Warren Park'
  );
