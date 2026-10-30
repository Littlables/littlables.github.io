-- Taste Reader (admin panel, manual-only).
-- Display title: The Reading Room (Taste Reader).
-- Step 1: data model only. No panel UI, no endpoint, no AI call, and no
-- change to the existing automatic curation runs.
--
-- Terminology: "balloons" is the public name for feed items, "content"
-- is the functional name, so new columns use content_id. The foreign
-- keys still point at public.news_stories(id) because that is the
-- table's current name; renaming that table to the functional name is
-- separate future work. "Stories" is reserved for storybook kids
-- activities and is not used for feed items here.
--
-- File name note: this file sorts after news_ingestion.sql in the
-- deploy workflow's `supabase/*.sql` glob order, so public.news_stories
-- already exists when the foreign keys below are created, including on
-- a fresh database. The workflow re-applies every migration file on
-- each migration run, so everything here is idempotent.
--
-- Access pattern (same as provider_sync_runs and news_stories): RLS is
-- enabled, no policies are created in this step, and only service_role
-- is granted access, because the admin panel talks to the worker, which
-- uses the service role. Per-user access for visitors comes later, and
-- then policies must be written as DROP POLICY IF EXISTS followed by
-- CREATE POLICY (the IF NOT EXISTS form is invalid for policies and
-- Postgres rejects it). RLS policies alone do not grant table
-- privileges, so the explicit GRANTs below are required (from
-- 2026-10-30, new public tables get no automatic grants).

-- One row per manual run. The run snapshots the 24-hour pub-date pool
-- so paging can fetch the next 10 from the same pool instead of
-- re-running selection.
create table if not exists public.classification_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  interest_filter text,
  total_count integer not null default 0,
  next_position integer not null default 0,
  created_at timestamptz not null default now()
);

-- The ordered pool for a run: one row per content item, in selection order.
create table if not exists public.classification_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.classification_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  content_id bigint not null references public.news_stories(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'served', 'viewed', 'skipped')),
  constraint classification_run_items_run_position_key unique (run_id, position)
);

-- Append-only word scoring events. Repeated marks on the same word sum
-- in the aggregate view; the reader UI (step 3) decides whether marks
-- toggle or stack, and this table supports either.
create table if not exists public.classification_word_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id bigint not null references public.news_stories(id) on delete cascade,
  run_id uuid references public.classification_runs(id) on delete cascade,
  word_display text not null,
  word_normalized text not null,
  source text not null check (source in ('title', 'description')),
  word_position integer not null,
  action text not null check (action in ('up', 'down', 'next', 'ignore', 'ban')),
  score_delta integer not null,
  created_at timestamptz not null default now()
);

-- Append-only notes and AI-generated reasons, so the table can grow
-- into per-user comments on content.
create table if not exists public.classification_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id bigint not null references public.news_stories(id) on delete cascade,
  run_id uuid references public.classification_runs(id) on delete cascade,
  kind text not null default 'user_note' check (kind in ('user_note', 'ai_reason')),
  body text not null,
  action_context text check (action_context in ('viewed', 'skipped', 'ignored', 'banned', 'next')),
  stopped_word_normalized text,
  stopped_position integer,
  ai_model text,
  created_at timestamptz not null default now()
);

create index if not exists classification_runs_user_created_idx
  on public.classification_runs (user_id, created_at desc);

create index if not exists classification_run_items_run_position_idx
  on public.classification_run_items (run_id, position);

create index if not exists classification_run_items_user_content_idx
  on public.classification_run_items (user_id, content_id);

create index if not exists classification_word_scores_user_word_idx
  on public.classification_word_scores (user_id, word_normalized);

create index if not exists classification_word_scores_content_user_idx
  on public.classification_word_scores (content_id, user_id);

create index if not exists classification_word_scores_run_idx
  on public.classification_word_scores (run_id);

create index if not exists classification_notes_user_content_idx
  on public.classification_notes (user_id, content_id, created_at desc);

create index if not exists classification_notes_run_idx
  on public.classification_notes (run_id);

alter table public.classification_runs enable row level security;
alter table public.classification_run_items enable row level security;
alter table public.classification_word_scores enable row level security;
alter table public.classification_notes enable row level security;

revoke all on public.classification_runs, public.classification_run_items,
  public.classification_word_scores, public.classification_notes
  from anon, authenticated;

grant select, insert, update, delete on public.classification_runs,
  public.classification_run_items, public.classification_word_scores,
  public.classification_notes to service_role;

-- Weighted keyword list (step 5 reads this shape). No separate
-- aggregate table in step 1: manual, admin-only volume makes this
-- grouped query trivial, and the view keeps the same shape if it is
-- ever materialized later.
drop view if exists public.classification_keyword_weights;

create view public.classification_keyword_weights as
  select
    user_id,
    word_normalized,
    sum(score_delta) as total_score,
    count(*) as event_count,
    count(*) filter (where action = 'up') as up_count,
    count(*) filter (where action = 'down') as down_count,
    count(*) filter (where action in ('next', 'ignore', 'ban')) as negative_action_count,
    max(created_at) as last_scored_at
  from public.classification_word_scores
  group by user_id, word_normalized;

grant select on public.classification_keyword_weights to service_role;
