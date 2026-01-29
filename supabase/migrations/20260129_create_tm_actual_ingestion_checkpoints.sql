-- =============================================================================
-- Migration: Create tm.actual_ingestion_checkpoints
-- Purpose: Per-user watermarks for incremental Actual ingestion
--
-- This table tracks which time windows have been processed for each user,
-- enabling idempotent incremental ingestion of screen time evidence into
-- calendar_actual events.
-- =============================================================================

create schema if not exists tm;

-- =============================================================================
-- Table: tm.actual_ingestion_checkpoints
-- =============================================================================

create table if not exists tm.actual_ingestion_checkpoints (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- User's timezone for window alignment
  timezone text not null default 'UTC',

  -- Timestamp when ingestion was last successfully completed
  last_processed_at timestamptz null,

  -- The window boundaries that were last processed
  last_processed_window_start timestamptz null,
  last_processed_window_end timestamptz null,

  -- Run statistics (for debugging/monitoring)
  last_run_stats jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for efficient lookups by user_id (primary key already provides this)
-- Additional index on last_processed_at for monitoring queries
create index if not exists tm_actual_ingestion_checkpoints_last_processed_idx
  on tm.actual_ingestion_checkpoints(last_processed_at desc nulls last);

-- =============================================================================
-- Trigger: updated_at auto-update
-- =============================================================================

drop trigger if exists update_tm_actual_ingestion_checkpoints_updated_at on tm.actual_ingestion_checkpoints;
create trigger update_tm_actual_ingestion_checkpoints_updated_at
before update on tm.actual_ingestion_checkpoints
for each row execute function public.update_updated_at_column();

-- =============================================================================
-- RLS Policies
-- =============================================================================

alter table tm.actual_ingestion_checkpoints enable row level security;

do $$
begin
  -- Select own checkpoint
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'actual_ingestion_checkpoints'
      and policyname = 'tm.actual_ingestion_checkpoints: select own'
  ) then
    execute $$create policy "tm.actual_ingestion_checkpoints: select own"
      on tm.actual_ingestion_checkpoints
      for select
      using (auth.uid() = user_id)$$;
  end if;

  -- Insert own checkpoint
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'actual_ingestion_checkpoints'
      and policyname = 'tm.actual_ingestion_checkpoints: insert own'
  ) then
    execute $$create policy "tm.actual_ingestion_checkpoints: insert own"
      on tm.actual_ingestion_checkpoints
      for insert
      with check (auth.uid() = user_id)$$;
  end if;

  -- Update own checkpoint
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'actual_ingestion_checkpoints'
      and policyname = 'tm.actual_ingestion_checkpoints: update own'
  ) then
    execute $$create policy "tm.actual_ingestion_checkpoints: update own"
      on tm.actual_ingestion_checkpoints
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- =============================================================================
-- Grants
-- =============================================================================

grant usage on schema tm to authenticated;
grant select, insert, update on tm.actual_ingestion_checkpoints to authenticated;
