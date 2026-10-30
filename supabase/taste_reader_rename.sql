-- Taste Reader step 1b: rename the step 1 tables from the old
-- "classification" prefix to the "taste_reader" prefix.
--
-- The step 1 file (supabase/story_classification_viewer.sql) is already
-- pushed and live, so it cannot be edited to rename the tables: the
-- deploy workflow re-applies every migration with ON_ERROR_STOP=1 and
-- CREATE TABLE IF NOT EXISTS would simply keep the old names. This
-- migration renames them in place instead.
--
-- Idempotency: the deploy workflow re-applies every migration file on
-- each migration run, so every rename here is guarded. Tables and
-- indexes rename only when the old name exists and the new name does
-- not; the view is dropped (if it exists) and recreated. On a fresh
-- database the step 1 file creates the old names first (it sorts
-- before this file: story_* < taste_*), then this file renames them.
-- On the live database it renames the existing tables once and is a
-- no-op afterwards.
--
-- Postgres updates foreign-key constraints automatically when the
-- referenced table is renamed, so the run_items / word_scores / notes
-- links to the runs table follow the rename with no extra work.
-- No worker or frontend code references these tables yet (step 2 is
-- not built), so no code changes accompany this rename.

-- Tables
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classification_runs')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'taste_reader_runs') then
    alter table public.classification_runs rename to taste_reader_runs;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classification_run_items')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'taste_reader_run_items') then
    alter table public.classification_run_items rename to taste_reader_run_items;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classification_word_scores')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'taste_reader_word_scores') then
    alter table public.classification_word_scores rename to taste_reader_word_scores;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classification_notes')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'taste_reader_notes') then
    alter table public.classification_notes rename to taste_reader_notes;
  end if;
end $$;

-- Unique constraint (table renames do not rename explicitly named
-- unique constraints either, so rename this one too). The same rename
-- also lives in supabase/classification_constraint_rename.sql, which
-- sorts before story_* and frees the old name before the step 1 file
-- re-creates its tables on a re-run; this copy makes a fresh database
-- end with the new name after its first run.
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

-- Indexes (table renames do not rename indexes, so rename them too)
do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_runs_user_created_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_runs_user_created_idx') then
    alter index public.classification_runs_user_created_idx rename to taste_reader_runs_user_created_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_run_items_run_position_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_run_items_run_position_idx') then
    alter index public.classification_run_items_run_position_idx rename to taste_reader_run_items_run_position_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_run_items_user_content_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_run_items_user_content_idx') then
    alter index public.classification_run_items_user_content_idx rename to taste_reader_run_items_user_content_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_word_scores_user_word_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_word_scores_user_word_idx') then
    alter index public.classification_word_scores_user_word_idx rename to taste_reader_word_scores_user_word_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_word_scores_content_user_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_word_scores_content_user_idx') then
    alter index public.classification_word_scores_content_user_idx rename to taste_reader_word_scores_content_user_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_word_scores_run_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_word_scores_run_idx') then
    alter index public.classification_word_scores_run_idx rename to taste_reader_word_scores_run_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_notes_user_content_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_notes_user_content_idx') then
    alter index public.classification_notes_user_content_idx rename to taste_reader_notes_user_content_idx;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'classification_notes_run_idx')
     and not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'taste_reader_notes_run_idx') then
    alter index public.classification_notes_run_idx rename to taste_reader_notes_run_idx;
  end if;
end $$;

-- View: same definition as step 1, reading the renamed scores table.
drop view if exists public.classification_keyword_weights;
drop view if exists public.taste_reader_keyword_weights;

create view public.taste_reader_keyword_weights as
  select
    user_id,
    word_normalized,
    sum(score_delta) as total_score,
    count(*) as event_count,
    count(*) filter (where action = 'up') as up_count,
    count(*) filter (where action = 'down') as down_count,
    count(*) filter (where action in ('next', 'ignore', 'ban')) as negative_action_count,
    max(created_at) as last_scored_at
  from public.taste_reader_word_scores
  group by user_id, word_normalized;

grant select on public.taste_reader_keyword_weights to service_role;

-- Stray old-prefix tables: on a re-run, the step 1 file recreates
-- classification_* tables (they were renamed away, so IF NOT EXISTS
-- does not skip them). They are empty by construction — the worker
-- only ever writes taste_reader_* — and this drop runs AFTER the
-- renames above, so a database that has never been renamed loses
-- nothing: its tables were just renamed, not dropped. Dropping the
-- strays here keeps every future re-run clean.
-- Children first: the stray child tables reference the stray runs
-- table, so dropping runs first would fail on the foreign keys.
drop table if exists public.classification_run_items;
drop table if exists public.classification_word_scores;
drop table if exists public.classification_notes;
drop table if exists public.classification_runs;
