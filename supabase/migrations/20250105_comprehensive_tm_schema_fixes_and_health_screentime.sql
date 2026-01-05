-- =============================================================================
-- Comprehensive Migration: Fix onboarding issues + Add Health/ScreenTime + Links + Hourly/Sessions
-- Purpose: 
--   1. Fix existing onboarding migration issues (FKs, policies, enums)
--   2. Create Health + Screen Time base tables (with security fixes)
--   3. Create tm.links polymorphic links table
--   4. Add per-app hourly and session breakdowns for Screen Time
-- =============================================================================

create schema if not exists tm;

-- =============================================================================
-- PART 1: Fix existing onboarding migration issues
-- =============================================================================

-- 1.1) Add 'goal' to tm.event_type enum (if it doesn't exist)
do $$ 
begin
  -- Check if enum exists, if not create it
  if not exists (select 1 from pg_type where typname = 'tm_event_type') then
    create type tm.event_type as enum (
      'meeting', 'call', 'message', 'email', 'drive', 'sleep', 'task', 'note', 'other',
      'communication', 'goal', 'project', 'category', 'tag',
      'slack_message', 'sms', 'phone_call', 'video_call', 'chat'
    );
  else
    -- Enum exists, add 'goal' if missing
    alter type tm.event_type add value if not exists 'goal';
  end if;
end $$;

-- 1.2) Fix tm.profile_values FK: change from auth.users to tm.profiles
-- This ensures profile_values can only exist for users who have a profile
alter table if exists tm.profile_values
  drop constraint if exists profile_values_user_id_fkey;

alter table if exists tm.profile_values
  add constraint profile_values_user_id_fkey
  foreign key (user_id)
  references tm.profiles(user_id)
  on delete cascade;

-- 1.3) Fix tm.routines: add composite unique constraint
alter table if exists tm.routines
  add constraint if not exists routines_id_user_id_uniq unique (id, user_id);

-- 1.4) Fix tm.routine_items: add composite FK to enforce consistency
alter table if exists tm.routine_items
  drop constraint if exists routine_items_routine_user_fk;

alter table if exists tm.routine_items
  add constraint routine_items_routine_user_fk
  foreign key (routine_id, user_id)
  references tm.routines (id, user_id)
  on delete cascade;

-- 1.5) Fix tm.events policies: use "create if not exists" instead of drop/recreate
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='events' and policyname='tm.events: select own'
  ) then
    execute $$create policy "tm.events: select own"
      on tm.events for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='events' and policyname='tm.events: insert own'
  ) then
    execute $$create policy "tm.events: insert own"
      on tm.events for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='events' and policyname='tm.events: update own'
  ) then
    execute $$create policy "tm.events: update own"
      on tm.events for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='events' and policyname='tm.events: delete own'
  ) then
    execute $$create policy "tm.events: delete own"
      on tm.events for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- 1.6) Fix tm.routines policies: use "create if not exists"
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routines' and policyname='tm.routines: select own'
  ) then
    execute $$create policy "tm.routines: select own"
      on tm.routines for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routines' and policyname='tm.routines: insert own'
  ) then
    execute $$create policy "tm.routines: insert own"
      on tm.routines for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routines' and policyname='tm.routines: update own'
  ) then
    execute $$create policy "tm.routines: update own"
      on tm.routines for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routines' and policyname='tm.routines: delete own'
  ) then
    execute $$create policy "tm.routines: delete own"
      on tm.routines for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- 1.7) Fix tm.routine_items policies: use "create if not exists"
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routine_items' and policyname='tm.routine_items: select own'
  ) then
    execute $$create policy "tm.routine_items: select own"
      on tm.routine_items for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routine_items' and policyname='tm.routine_items: insert own'
  ) then
    execute $$create policy "tm.routine_items: insert own"
      on tm.routine_items for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routine_items' and policyname='tm.routine_items: update own'
  ) then
    execute $$create policy "tm.routine_items: update own"
      on tm.routine_items for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='routine_items' and policyname='tm.routine_items: delete own'
  ) then
    execute $$create policy "tm.routine_items: delete own"
      on tm.routine_items for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- =============================================================================
-- PART 2: Health + Screen Time base tables (with security fixes)
-- =============================================================================

-- 2.1) tm.data_sync_state
create table if not exists tm.data_sync_state (
  user_id uuid not null references auth.users(id) on delete cascade,

  dataset text not null,        -- 'health' | 'screen_time'
  platform text not null,       -- 'ios' | 'android'
  provider text not null,       -- 'healthkit' | 'health_connect' | 'ios_screentime' | 'android_digital_wellbeing' | etc.

  oldest_synced_local_date date null,
  newest_synced_local_date date null,

  cursor jsonb not null default '{}'::jsonb,

  last_sync_started_at timestamptz null,
  last_sync_finished_at timestamptz null,
  last_sync_status text null,   -- 'ok' | 'partial' | 'error'
  last_sync_error text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, dataset, platform, provider)
);

drop trigger if exists update_tm_data_sync_state_updated_at on tm.data_sync_state;
create trigger update_tm_data_sync_state_updated_at
before update on tm.data_sync_state
for each row execute function public.update_updated_at_column();

alter table tm.data_sync_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='data_sync_state' and policyname='tm.data_sync_state: select own'
  ) then
    execute $$create policy "tm.data_sync_state: select own"
      on tm.data_sync_state for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='data_sync_state' and policyname='tm.data_sync_state: insert own'
  ) then
    execute $$create policy "tm.data_sync_state: insert own"
      on tm.data_sync_state for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='data_sync_state' and policyname='tm.data_sync_state: update own'
  ) then
    execute $$create policy "tm.data_sync_state: update own"
      on tm.data_sync_state for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- 2.2) tm.health_daily_metrics
create table if not exists tm.health_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  local_date date not null,
  timezone text not null default 'UTC',

  platform text not null,
  provider text not null,
  source_device_id text null,

  window_start timestamptz null,
  window_end timestamptz null,

  steps integer null,
  active_energy_kcal numeric(12, 3) null,
  distance_meters numeric(14, 3) null,

  sleep_asleep_seconds integer null,

  heart_rate_avg_bpm numeric(12, 3) null,
  resting_heart_rate_avg_bpm numeric(12, 3) null,
  hrv_sdnn_seconds numeric(12, 6) null,

  workouts_count integer null,
  workouts_duration_seconds integer null,

  exercise_minutes numeric(12, 3) null,
  stand_hours numeric(12, 3) null,
  move_goal_kcal numeric(12, 3) null,
  exercise_goal_minutes numeric(12, 3) null,
  stand_goal_hours numeric(12, 3) null,

  raw_payload jsonb null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tm_health_daily_unique unique (user_id, local_date, platform, provider)
);

create index if not exists tm_health_daily_user_date_idx
  on tm.health_daily_metrics(user_id, local_date desc);

create index if not exists tm_health_daily_user_provider_idx
  on tm.health_daily_metrics(user_id, provider, platform, local_date desc);

drop trigger if exists update_tm_health_daily_metrics_updated_at on tm.health_daily_metrics;
create trigger update_tm_health_daily_metrics_updated_at
before update on tm.health_daily_metrics
for each row execute function public.update_updated_at_column();

alter table tm.health_daily_metrics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='health_daily_metrics' and policyname='tm.health_daily_metrics: select own'
  ) then
    execute $$create policy "tm.health_daily_metrics: select own"
      on tm.health_daily_metrics for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='health_daily_metrics' and policyname='tm.health_daily_metrics: insert own'
  ) then
    execute $$create policy "tm.health_daily_metrics: insert own"
      on tm.health_daily_metrics for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='health_daily_metrics' and policyname='tm.health_daily_metrics: update own'
  ) then
    execute $$create policy "tm.health_daily_metrics: update own"
      on tm.health_daily_metrics for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- 2.3) tm.health_workouts
create table if not exists tm.health_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  platform text not null,
  provider text not null,
  provider_workout_id text null,
  source_device_id text null,

  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),

  activity_type text null,
  total_energy_kcal numeric(12, 3) null,
  distance_meters numeric(14, 3) null,
  avg_heart_rate_bpm numeric(12, 3) null,
  max_heart_rate_bpm numeric(12, 3) null,

  raw_payload jsonb null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tm_health_workouts_user_started_idx
  on tm.health_workouts(user_id, started_at desc);

create unique index if not exists tm_health_workouts_provider_id_uniq
  on tm.health_workouts(user_id, provider, platform, provider_workout_id)
  where provider_workout_id is not null;

drop trigger if exists update_tm_health_workouts_updated_at on tm.health_workouts;
create trigger update_tm_health_workouts_updated_at
before update on tm.health_workouts
for each row execute function public.update_updated_at_column();

alter table tm.health_workouts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='health_workouts' and policyname='tm.health_workouts: select own'
  ) then
    execute $$create policy "tm.health_workouts: select own"
      on tm.health_workouts for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='health_workouts' and policyname='tm.health_workouts: insert own'
  ) then
    execute $$create policy "tm.health_workouts: insert own"
      on tm.health_workouts for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='health_workouts' and policyname='tm.health_workouts: update own'
  ) then
    execute $$create policy "tm.health_workouts: update own"
      on tm.health_workouts for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- 2.4) tm.screen_time_daily
create table if not exists tm.screen_time_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  local_date date not null,
  timezone text not null default 'UTC',

  platform text not null,
  provider text not null,
  source_device_id text null,

  total_seconds integer not null default 0 check (total_seconds >= 0),
  pickups integer null check (pickups is null or pickups >= 0),
  notifications integer null check (notifications is null or notifications >= 0),

  raw_payload jsonb null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tm_screen_time_daily_unique unique (user_id, local_date, platform, provider)
);

create index if not exists tm_screen_time_daily_user_date_idx
  on tm.screen_time_daily(user_id, local_date desc);

drop trigger if exists update_tm_screen_time_daily_updated_at on tm.screen_time_daily;
create trigger update_tm_screen_time_daily_updated_at
before update on tm.screen_time_daily
for each row execute function public.update_updated_at_column();

alter table tm.screen_time_daily enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_daily' and policyname='tm.screen_time_daily: select own'
  ) then
    execute $$create policy "tm.screen_time_daily: select own"
      on tm.screen_time_daily for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_daily' and policyname='tm.screen_time_daily: insert own'
  ) then
    execute $$create policy "tm.screen_time_daily: insert own"
      on tm.screen_time_daily for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_daily' and policyname='tm.screen_time_daily: update own'
  ) then
    execute $$create policy "tm.screen_time_daily: update own"
      on tm.screen_time_daily for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- 2.5) tm.screen_time_app_daily
create table if not exists tm.screen_time_app_daily (
  id uuid primary key default gen_random_uuid(),
  screen_time_daily_id uuid not null references tm.screen_time_daily(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  app_id text not null,
  display_name text null,

  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  pickups integer null check (pickups is null or pickups >= 0),
  notifications integer null check (notifications is null or notifications >= 0),

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint tm_screen_time_app_daily_unique unique (screen_time_daily_id, app_id)
);

create index if not exists tm_screen_time_app_daily_user_idx
  on tm.screen_time_app_daily(user_id, created_at desc);

create index if not exists tm_screen_time_app_daily_user_app_idx
  on tm.screen_time_app_daily(user_id, app_id);

alter table tm.screen_time_app_daily enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_daily' and policyname='tm.screen_time_app_daily: select own'
  ) then
    execute $$create policy "tm.screen_time_app_daily: select own"
      on tm.screen_time_app_daily for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_daily' and policyname='tm.screen_time_app_daily: insert own'
  ) then
    execute $$create policy "tm.screen_time_app_daily: insert own"
      on tm.screen_time_app_daily for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_daily' and policyname='tm.screen_time_app_daily: update own'
  ) then
    execute $$create policy "tm.screen_time_app_daily: update own"
      on tm.screen_time_app_daily for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- 2.6) Views (NOT materialized - security fix)
create or replace view tm.health_daily_latest as
select distinct on (user_id, local_date)
  *
from tm.health_daily_metrics
order by user_id, local_date, updated_at desc;

create or replace view tm.screen_time_daily_latest as
select distinct on (user_id, local_date)
  *
from tm.screen_time_daily
order by user_id, local_date, updated_at desc;

-- NOTE: Materialized views are NOT granted to authenticated (security fix)
-- Server/service-role only access for weekly/monthly rollups
create materialized view if not exists tm.health_weekly_rollup as
select
  user_id,
  date_trunc('week', local_date::timestamptz)::date as week_start_local_date,
  timezone,
  sum(steps) as steps,
  sum(active_energy_kcal) as active_energy_kcal,
  sum(distance_meters) as distance_meters,
  sum(sleep_asleep_seconds) as sleep_asleep_seconds,
  avg(heart_rate_avg_bpm) as heart_rate_avg_bpm,
  avg(resting_heart_rate_avg_bpm) as resting_heart_rate_avg_bpm,
  avg(hrv_sdnn_seconds) as hrv_sdnn_seconds,
  sum(workouts_count) as workouts_count,
  sum(workouts_duration_seconds) as workouts_duration_seconds
from tm.health_daily_latest
group by user_id, week_start_local_date, timezone;

create unique index if not exists tm_health_weekly_rollup_uniq
  on tm.health_weekly_rollup(user_id, week_start_local_date);

create materialized view if not exists tm.health_monthly_rollup as
select
  user_id,
  date_trunc('month', local_date::timestamptz)::date as month_start_local_date,
  timezone,
  sum(steps) as steps,
  sum(active_energy_kcal) as active_energy_kcal,
  sum(distance_meters) as distance_meters,
  sum(sleep_asleep_seconds) as sleep_asleep_seconds,
  avg(heart_rate_avg_bpm) as heart_rate_avg_bpm,
  avg(resting_heart_rate_avg_bpm) as resting_heart_rate_avg_bpm,
  avg(hrv_sdnn_seconds) as hrv_sdnn_seconds,
  sum(workouts_count) as workouts_count,
  sum(workouts_duration_seconds) as workouts_duration_seconds
from tm.health_daily_latest
group by user_id, month_start_local_date, timezone;

create unique index if not exists tm_health_monthly_rollup_uniq
  on tm.health_monthly_rollup(user_id, month_start_local_date);

-- =============================================================================
-- PART 3: tm.links polymorphic links table
-- =============================================================================

-- 3.1) Enum of linkable object types
do $$ begin
  create type tm.link_object_type as enum (
    'event',
    'contact',
    'goal',
    'project',
    'task',
    'tag',
    'asset',
    'communication'
  );
exception when duplicate_object then null;
end $$;

-- 3.2) Generic links table
create table if not exists tm.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  obj1_type tm.link_object_type not null,
  obj1_id   uuid not null,

  obj2_type tm.link_object_type not null,
  obj2_id   uuid not null,

  link_kind text not null,

  canonical_key text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.3) Guardrails
alter table tm.links
  add constraint if not exists tm_links_no_self_link
  check (not (obj1_type = obj2_type and obj1_id = obj2_id));

-- 3.4) Indexes
create index if not exists idx_links_user_obj1
  on tm.links (user_id, obj1_type, obj1_id);

create index if not exists idx_links_user_obj2
  on tm.links (user_id, obj2_type, obj2_id);

create index if not exists idx_links_user_kind
  on tm.links (user_id, link_kind);

create unique index if not exists u_links_user_canonical
  on tm.links (user_id, canonical_key);

-- 3.5) updated_at trigger
drop trigger if exists update_tm_links_updated_at on tm.links;
create trigger update_tm_links_updated_at
before update on tm.links
for each row execute function public.update_updated_at_column();

-- 3.6) Canonical key trigger
create or replace function tm.set_links_canonical_key()
returns trigger language plpgsql as $$
declare
  a text;
  b text;
begin
  a := new.obj1_type::text || ':' || new.obj1_id::text;
  b := new.obj2_type::text || ':' || new.obj2_id::text;

  if a <= b then
    new.canonical_key := a || '||' || new.link_kind || '||' || b;
  else
    new.canonical_key := b || '||' || new.link_kind || '||' || a;
  end if;

  return new;
end $$;

drop trigger if exists trg_links_canonical on tm.links;
create trigger trg_links_canonical
before insert or update on tm.links
for each row execute function tm.set_links_canonical_key();

-- 3.7) RLS
alter table tm.links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='links' and policyname='tm.links: select own'
  ) then
    execute $$create policy "tm.links: select own"
      on tm.links for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='links' and policyname='tm.links: insert own'
  ) then
    execute $$create policy "tm.links: insert own"
      on tm.links for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='links' and policyname='tm.links: update own'
  ) then
    execute $$create policy "tm.links: update own"
      on tm.links for update using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='links' and policyname='tm.links: delete own'
  ) then
    execute $$create policy "tm.links: delete own"
      on tm.links for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- =============================================================================
-- PART 4: Per-app hourly and session breakdowns (extends Screen Time)
-- =============================================================================

-- 4.1) tm.screen_time_app_hourly
create table if not exists tm.screen_time_app_hourly (
  id uuid primary key default gen_random_uuid(),
  screen_time_daily_id uuid not null references tm.screen_time_daily(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  local_date date not null,
  hour integer not null check (hour >= 0 and hour < 24),
  app_id text not null,
  display_name text null,

  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  pickups integer null check (pickups is null or pickups >= 0),

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint tm_screen_time_app_hourly_unique unique (screen_time_daily_id, hour, app_id)
);

create index if not exists tm_screen_time_app_hourly_user_date_hour_idx
  on tm.screen_time_app_hourly(user_id, local_date, hour);

create index if not exists tm_screen_time_app_hourly_user_app_idx
  on tm.screen_time_app_hourly(user_id, app_id, local_date desc);

alter table tm.screen_time_app_hourly enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_hourly' and policyname='tm.screen_time_app_hourly: select own'
  ) then
    execute $$create policy "tm.screen_time_app_hourly: select own"
      on tm.screen_time_app_hourly for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_hourly' and policyname='tm.screen_time_app_hourly: insert own'
  ) then
    execute $$create policy "tm.screen_time_app_hourly: insert own"
      on tm.screen_time_app_hourly for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_hourly' and policyname='tm.screen_time_app_hourly: update own'
  ) then
    execute $$create policy "tm.screen_time_app_hourly: update own"
      on tm.screen_time_app_hourly for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- 4.2) tm.screen_time_app_sessions
create table if not exists tm.screen_time_app_sessions (
  id uuid primary key default gen_random_uuid(),
  screen_time_daily_id uuid not null references tm.screen_time_daily(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  local_date date not null,
  app_id text not null,
  display_name text null,

  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  pickups integer null check (pickups is null or pickups >= 0),

  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint tm_screen_time_app_sessions_time_order check (ended_at >= started_at)
);

create index if not exists tm_screen_time_app_sessions_user_date_started_idx
  on tm.screen_time_app_sessions(user_id, local_date, started_at);

create index if not exists tm_screen_time_app_sessions_user_app_idx
  on tm.screen_time_app_sessions(user_id, app_id, started_at desc);

-- Index for overlap queries (calendar derivation)
create index if not exists tm_screen_time_app_sessions_time_range_idx
  on tm.screen_time_app_sessions using gist (user_id, tstzrange(started_at, ended_at));

alter table tm.screen_time_app_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_sessions' and policyname='tm.screen_time_app_sessions: select own'
  ) then
    execute $$create policy "tm.screen_time_app_sessions: select own"
      on tm.screen_time_app_sessions for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_sessions' and policyname='tm.screen_time_app_sessions: insert own'
  ) then
    execute $$create policy "tm.screen_time_app_sessions: insert own"
      on tm.screen_time_app_sessions for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_sessions' and policyname='tm.screen_time_app_sessions: update own'
  ) then
    execute $$create policy "tm.screen_time_app_sessions: update own"
      on tm.screen_time_app_sessions for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- =============================================================================
-- PART 5: Grants (authenticated clients) - SECURITY FIX: NO materialized views
-- =============================================================================

grant usage on schema tm to authenticated;

grant select, insert, update, delete on tm.data_sync_state to authenticated;
grant select, insert, update, delete on tm.health_daily_metrics to authenticated;
grant select, insert, update, delete on tm.health_workouts to authenticated;
grant select, insert, update, delete on tm.screen_time_daily to authenticated;
grant select, insert, update, delete on tm.screen_time_app_daily to authenticated;
grant select, insert, update, delete on tm.screen_time_app_hourly to authenticated;
grant select, insert, update, delete on tm.screen_time_app_sessions to authenticated;
grant select, insert, update, delete on tm.links to authenticated;

grant select on tm.health_daily_latest to authenticated;
grant select on tm.screen_time_daily_latest to authenticated;

-- NOTE: Materialized views (health_weekly_rollup, health_monthly_rollup) are NOT granted
-- to authenticated. They are server/service-role only for security.

