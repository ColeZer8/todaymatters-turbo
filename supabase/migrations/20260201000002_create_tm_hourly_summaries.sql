-- Migration: Create tm.hourly_summaries table
-- Description: CHARLIE layer table for user-facing hourly summaries with feedback capabilities
-- User Story: DP-002
-- Reference: docs/data-pipeline-plan.md section 4.2

-- =============================================================================
-- tm.hourly_summaries - User-facing hourly summaries (CHARLIE layer)
-- =============================================================================
create table if not exists tm.hourly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Time
  hour_start timestamptz not null, -- e.g., 2026-02-01T09:00:00Z
  local_date date not null, -- For easy querying by day
  hour_of_day smallint not null check (hour_of_day >= 0 and hour_of_day < 24),

  -- Summary content
  title text not null, -- "Office - Deep Work"
  description text, -- AI-polished or template-generated

  -- Aggregated data
  primary_place_id uuid references tm.user_places(id) on delete set null,
  primary_place_label text,
  primary_activity text,

  app_breakdown jsonb default '[]'::jsonb, -- [{app_id, display_name, category, minutes}]
  total_screen_minutes integer default 0 check (total_screen_minutes >= 0),

  -- Quality indicators
  confidence_score numeric(3, 2) check (confidence_score >= 0 and confidence_score <= 1), -- 0.00 to 1.00
  evidence_strength text, -- low, medium, high (based on data coverage)

  -- User feedback
  user_feedback text, -- 'accurate', 'inaccurate', null
  user_edits jsonb default '{}'::jsonb, -- Track what user changed: {original_title, edited_title, ...}
  locked_at timestamptz, -- When user confirmed/edited (becomes immutable)

  -- AI tracking
  ai_generated boolean default false,
  ai_model text, -- Which model was used (if any)

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Unique constraint: one summary per user per hour
  constraint hourly_summaries_user_hour_unique unique (user_id, hour_start)
);

-- Add comments for documentation
comment on table tm.hourly_summaries is 'CHARLIE layer: User-facing hourly summaries with feedback capabilities';
comment on column tm.hourly_summaries.hour_start is 'Start of the hour this summary covers (e.g., 2026-02-01T09:00:00Z)';
comment on column tm.hourly_summaries.local_date is 'Local date for easy day-based queries';
comment on column tm.hourly_summaries.hour_of_day is 'Hour of day (0-23) for time-based analysis';
comment on column tm.hourly_summaries.app_breakdown is 'Array of objects: [{app_id, display_name, category, minutes}]';
comment on column tm.hourly_summaries.evidence_strength is 'Data coverage quality: low, medium, high';
comment on column tm.hourly_summaries.user_feedback is 'User feedback: accurate, inaccurate, or null (no feedback)';
comment on column tm.hourly_summaries.user_edits is 'JSON tracking user corrections: {original_title, edited_title, ...}';
comment on column tm.hourly_summaries.locked_at is 'Timestamp when user confirmed/edited; prevents re-processing';

-- =============================================================================
-- Indexes
-- =============================================================================

-- Primary lookup: user's summaries by date (for day view)
create index if not exists idx_hourly_summaries_user_date
  on tm.hourly_summaries(user_id, local_date desc);

-- Unlocked summaries only (for processing queue)
create index if not exists idx_hourly_summaries_unlocked
  on tm.hourly_summaries(user_id, hour_start desc)
  where locked_at is null;

-- Time range queries (for recent summaries)
create index if not exists idx_hourly_summaries_user_hour
  on tm.hourly_summaries(user_id, hour_start desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table tm.hourly_summaries enable row level security;

-- RLS policies (idempotent)
do $$
begin
  -- Select policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'hourly_summaries'
      and policyname = 'hourly_summaries_select_own'
  ) then
    create policy hourly_summaries_select_own
      on tm.hourly_summaries
      for select
      using (auth.uid() = user_id);
  end if;

  -- Insert policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'hourly_summaries'
      and policyname = 'hourly_summaries_insert_own'
  ) then
    create policy hourly_summaries_insert_own
      on tm.hourly_summaries
      for insert
      with check (auth.uid() = user_id);
  end if;

  -- Update policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'hourly_summaries'
      and policyname = 'hourly_summaries_update_own'
  ) then
    create policy hourly_summaries_update_own
      on tm.hourly_summaries
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  -- Delete policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'hourly_summaries'
      and policyname = 'hourly_summaries_delete_own'
  ) then
    create policy hourly_summaries_delete_own
      on tm.hourly_summaries
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- =============================================================================
-- Grants
-- =============================================================================
grant select, insert, update, delete on tm.hourly_summaries to authenticated;
