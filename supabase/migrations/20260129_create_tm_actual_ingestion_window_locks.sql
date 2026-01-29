-- Migration: Create tm.actual_ingestion_window_locks table
-- Description: Track which 30-min windows have been processed so they're never reprocessed
-- User Story: US-001

-- Create the table
create table if not exists tm.actual_ingestion_window_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  locked_at timestamptz not null default now(),
  stats jsonb default '{}'::jsonb,
  constraint actual_ingestion_window_locks_window_start_unique unique (user_id, window_start)
);

-- Add comment for documentation
comment on table tm.actual_ingestion_window_locks is 'Tracks which 30-min windows have been processed so they are never reprocessed';

-- Create index for fast lookups
create index if not exists actual_ingestion_window_locks_user_window_start_idx
  on tm.actual_ingestion_window_locks (user_id, window_start);

-- Enable RLS
alter table tm.actual_ingestion_window_locks enable row level security;

-- Create RLS policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'actual_ingestion_window_locks'
      and policyname = 'Users can select own window locks'
  ) then
    execute $policy$
      create policy "Users can select own window locks"
        on tm.actual_ingestion_window_locks
        for select
        using (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'actual_ingestion_window_locks'
      and policyname = 'Users can insert own window locks'
  ) then
    execute $policy$
      create policy "Users can insert own window locks"
        on tm.actual_ingestion_window_locks
        for insert
        with check (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

-- Grant permissions
grant select, insert on tm.actual_ingestion_window_locks to authenticated;
