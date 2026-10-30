-- Live provider sync run tracking (admin panel run strip).
-- One row per run: hourly cron, Sync-all, stale check, or single-provider
-- update. Heartbeats during the run record pairs done, the current pair,
-- and the last fetch telemetry, so a stuck run shows exactly where it died.
create table if not exists public.provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null,
  provider text,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pairs_total integer,
  pairs_done integer not null default 0,
  current_provider text,
  current_category text,
  last_activity_at timestamptz,
  last_telemetry jsonb,
  summary jsonb
);

alter table public.provider_sync_runs enable row level security;

grant select, insert, update, delete on public.provider_sync_runs to service_role;

create index if not exists provider_sync_runs_started_at_idx
  on public.provider_sync_runs (started_at desc);
