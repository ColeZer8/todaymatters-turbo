-- =============================================================================
-- Migration: Add per-app hourly breakdowns and per-app time intervals for Screen Time
-- Purpose: Enable detailed Screen Time analytics and accurate calendar "distracted" annotations
-- =============================================================================

create schema if not exists tm;

-- -----------------------------------------------------------------------------
-- tm.screen_time_app_hourly
-- Per-app usage breakdown by hour (24 hours per day).
-- Enables "which apps were used in each hour" queries for calendar derivation.
-- -----------------------------------------------------------------------------
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

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_hourly' and policyname='tm.screen_time_app_hourly: service role read'
  ) then
    execute $$create policy "tm.screen_time_app_hourly: service role read"
      on tm.screen_time_app_hourly for select
      using (auth.role() = 'service_role')$$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- tm.screen_time_app_sessions
-- Per-app time intervals (start/end times for each app usage session).
-- Enables precise overlap detection for calendar "distracted" annotations.
-- -----------------------------------------------------------------------------
create table if not exists tm.screen_time_app_sessions (
  id uuid primary key default gen_random_uuid(),
  screen_time_daily_id uuid not null references tm.screen_time_daily(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  local_date date not null,
  app_id text not null,
  display_name text null,

  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds >= 0 and duration_seconds = extract(epoch from (ended_at - started_at))::integer),
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

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='screen_time_app_sessions' and policyname='tm.screen_time_app_sessions: service role read'
  ) then
    execute $$create policy "tm.screen_time_app_sessions: service role read"
      on tm.screen_time_app_sessions for select
      using (auth.role() = 'service_role')$$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Grants (authenticated clients)
-- -----------------------------------------------------------------------------
grant usage on schema tm to authenticated;

grant select, insert, update, delete on tm.screen_time_app_hourly to authenticated;
grant select, insert, update, delete on tm.screen_time_app_sessions to authenticated;

