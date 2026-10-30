-- Taste Reader: rename the run-items unique constraint left behind by
-- the table rename, BEFORE the step 1 file re-runs.
--
-- Why this file exists, and why its name matters: the deploy workflow
-- re-applies every supabase/*.sql file in glob order on each migration
-- run, so supabase/story_classification_viewer.sql (story_* > c*) runs
-- before supabase/taste_reader_rename.sql (taste_*) on every run.
--
-- Renaming a table does NOT rename its explicitly named unique
-- constraint's underlying index. After taste_reader_rename.sql renamed
-- classification_run_items to taste_reader_run_items, the constraint
-- classification_run_items_run_position_key still lived on the renamed
-- table. On the next migration run, the step 1 file's
-- CREATE TABLE IF NOT EXISTS classification_run_items tried to recreate
-- that constraint name and failed with:
--   ERROR: relation "classification_run_items_run_position_key" already
--   exists
-- (story_classification_viewer.sql:53), aborting the whole migration
-- file under ON_ERROR_STOP before the rename file ever ran, so the
-- failure repeated on every subsequent run. Primary-key indexes do not
-- hit this: Postgres auto-renames a colliding PK index with a suffix
-- (classification_runs_pkey1); an explicitly named unique constraint
-- fails instead.
--
-- This file sorts before story_* (classification_* < story_*), so it
-- frees the old name before the step 1 file tries to reuse it. It is
-- fully guarded and a no-op on a fresh database (no taste_reader table
-- yet) and on a database where the constraint was already renamed.
-- The same rename is also in taste_reader_rename.sql, so a fresh
-- database ends with the new name after its first run, not just after
-- its second.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'classification_run_items_run_position_key'
      and conrelid = to_regclass('public.taste_reader_run_items')
  ) and not exists (
    select 1 from pg_constraint
    where conname = 'taste_reader_run_items_run_position_key'
      and conrelid = to_regclass('public.taste_reader_run_items')
  ) then
    alter table public.taste_reader_run_items
      rename constraint classification_run_items_run_position_key
      to taste_reader_run_items_run_position_key;
  end if;
end $$;
