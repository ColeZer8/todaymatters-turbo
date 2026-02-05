-- Migration: Create tm.activity_segments table
-- Description: BRAVO layer table for enriched activity blocks derived from raw telemetry
-- User Story: DP-001
-- Reference: docs/data-pipeline-plan.md section 4.1

-- =============================================================================
-- tm.activity_segments - Enriched activity blocks (BRAVO layer)
-- =============================================================================
create table if not exists tm.activity_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Time bounds
  started_at timestamptz not null,
  ended_at timestamptz not null,
  hour_bucket timestamptz not null, -- Floor to hour for indexing

  -- Location enrichment
  place_id uuid references tm.user_places(id) on delete set null,
  place_label text, -- Denormalized for display
  place_category text, -- work, home, gym, commute, etc.
  location_lat numeric(10, 7),
  location_lng numeric(10, 7),

  -- Activity inference
  inferred_activity text, -- deep_work, meeting, commute, social, leisure, etc.
  activity_confidence numeric(3, 2) check (activity_confidence >= 0 and activity_confidence <= 1), -- 0.00 to 1.00

  -- App usage breakdown (denormalized)
  top_apps jsonb default '[]'::jsonb, -- [{app_id, display_name, category, seconds}]
  total_screen_seconds integer default 0 check (total_screen_seconds >= 0),

  -- Evidence tracking
  evidence jsonb default '{}'::jsonb, -- {location_samples: 12, screen_sessions: 5, ...}

  -- Source linkage
  source_ids text[], -- ALPHA layer record IDs used

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add comments for documentation
comment on table tm.activity_segments is 'BRAVO layer: Enriched activity blocks derived from raw telemetry (location, screen time, health)';
comment on column tm.activity_segments.hour_bucket is 'Floored to hour for efficient indexing and queries';
comment on column tm.activity_segments.top_apps is 'Array of objects: [{app_id, display_name, category, seconds}]';
comment on column tm.activity_segments.evidence is 'Metadata about source data: {location_samples, screen_sessions, has_health_data}';
comment on column tm.activity_segments.source_ids is 'IDs of ALPHA layer records used to generate this segment';

-- =============================================================================
-- Indexes
-- =============================================================================

-- Primary lookup: user's segments by hour
create index if not exists idx_activity_segments_user_hour
  on tm.activity_segments(user_id, hour_bucket desc);

-- Place-based lookups
create index if not exists idx_activity_segments_place
  on tm.activity_segments(user_id, place_id);

-- Time range queries
create index if not exists idx_activity_segments_user_time
  on tm.activity_segments(user_id, started_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table tm.activity_segments enable row level security;

-- RLS policies (idempotent)
do $$
begin
  -- Select policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_segments'
      and policyname = 'activity_segments_select_own'
  ) then
    create policy activity_segments_select_own
      on tm.activity_segments
      for select
      using (auth.uid() = user_id);
  end if;

  -- Insert policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_segments'
      and policyname = 'activity_segments_insert_own'
  ) then
    create policy activity_segments_insert_own
      on tm.activity_segments
      for insert
      with check (auth.uid() = user_id);
  end if;

  -- Update policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_segments'
      and policyname = 'activity_segments_update_own'
  ) then
    create policy activity_segments_update_own
      on tm.activity_segments
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  -- Delete policy
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm'
      and tablename = 'activity_segments'
      and policyname = 'activity_segments_delete_own'
  ) then
    create policy activity_segments_delete_own
      on tm.activity_segments
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- =============================================================================
-- Grants
-- =============================================================================
grant select, insert, update, delete on tm.activity_segments to authenticated;
