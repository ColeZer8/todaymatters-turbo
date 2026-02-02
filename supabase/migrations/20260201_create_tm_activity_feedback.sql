-- Migration: Create tm.activity_feedback table
-- Description: Feedback learning loop table for storing user corrections to activity/summary data
-- User Story: DP-003
-- Reference: docs/data-pipeline-plan.md section 4.3

-- =============================================================================
-- tm.activity_feedback - Learn from user corrections
-- =============================================================================
create table if not exists tm.activity_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What was corrected
  hourly_summary_id uuid references tm.hourly_summaries(id) on delete set null,
  segment_id uuid references tm.activity_segments(id) on delete set null,

  -- Original vs corrected values
  original_activity text,
  corrected_activity text,
  original_place_label text,
  corrected_place_label text,
  original_title text,
  corrected_title text,

  -- Context for learning (hour of day, day of week, top apps, etc.)
  context_data jsonb default '{}'::jsonb,

  -- Timestamps
  created_at timestamptz not null default now()
);

-- Add comments for documentation
comment on table tm.activity_feedback is 'Feedback learning loop: Stores user corrections to enable pattern learning';
comment on column tm.activity_feedback.hourly_summary_id is 'Reference to the hourly summary that was corrected';
comment on column tm.activity_feedback.segment_id is 'Reference to the activity segment that was corrected';
comment on column tm.activity_feedback.original_activity is 'Original inferred activity before user correction';
comment on column tm.activity_feedback.corrected_activity is 'User-provided corrected activity';
comment on column tm.activity_feedback.context_data is 'Learning context: {hour_of_day, day_of_week, top_apps, confidence, ...}';

-- =============================================================================
-- Indexes
-- =============================================================================

-- Primary lookup: user's feedback history for learning queries
create index if not exists idx_activity_feedback_user_context
  on tm.activity_feedback(user_id, created_at desc);

-- Lookup by hourly summary (for retrieving corrections)
create index if not exists idx_activity_feedback_summary
  on tm.activity_feedback(hourly_summary_id)
  where hourly_summary_id is not null;

-- Lookup by segment (for segment-level corrections)
create index if not exists idx_activity_feedback_segment
  on tm.activity_feedback(segment_id)
  where segment_id is not null;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table tm.activity_feedback enable row level security;

-- RLS policies (idempotent)
do $$
begin
  -- Select policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_feedback'
      and policyname = 'activity_feedback_select_own'
  ) then
    create policy activity_feedback_select_own
      on tm.activity_feedback
      for select
      using (auth.uid() = user_id);
  end if;

  -- Insert policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_feedback'
      and policyname = 'activity_feedback_insert_own'
  ) then
    create policy activity_feedback_insert_own
      on tm.activity_feedback
      for insert
      with check (auth.uid() = user_id);
  end if;

  -- Update policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_feedback'
      and policyname = 'activity_feedback_update_own'
  ) then
    create policy activity_feedback_update_own
      on tm.activity_feedback
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  -- Delete policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_feedback'
      and policyname = 'activity_feedback_delete_own'
  ) then
    create policy activity_feedback_delete_own
      on tm.activity_feedback
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- =============================================================================
-- Grants
-- =============================================================================
grant select, insert, update, delete on tm.activity_feedback to authenticated;
