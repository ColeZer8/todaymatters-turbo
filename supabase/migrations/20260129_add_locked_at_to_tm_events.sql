-- Migration: Add locked_at column to tm.events
-- Description: Mark events as immutable after their window is processed
-- User Story: US-002

-- Add locked_at column (nullable - null means not yet locked)
alter table tm.events
  add column if not exists locked_at timestamptz null;

-- Add comment for documentation
comment on column tm.events.locked_at is 'When set, this event is immutable and cannot be modified by ingestion';

-- Create partial index for fast lookups of locked events
create index if not exists tm_events_user_locked_at_idx
  on tm.events (user_id, locked_at)
  where locked_at is not null;
