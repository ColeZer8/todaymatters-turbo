-- Today Matters: tm schema tables for onboarding + core app data
-- This migration creates the `tm` schema and the tables needed for the 12 onboarding screens:
-- permissions, setup-questions, daily-rhythm, joy, drains, your-why, focus-style, coach-persona,
-- morning-mindset, goals, build-routine, ideal-day

-- -----------------------------------------------------------------------------
-- Schema
-- -----------------------------------------------------------------------------
create schema if not exists tm;

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger function (ensure it exists in public)
-- -----------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- tm.profiles
-- Stores onboarding fields that are 1:1 with a user.
-- -----------------------------------------------------------------------------
create table if not exists tm.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- onboarding: setup-questions, daily-rhythm, your-why
  role text null,
  mission text null,
  ideal_work_day time null,
  ideal_sabbath time null,

  -- general identity
  full_name text null,
  birthday date null,
  timezone text not null default 'UTC',

  -- onboarding: preferences + permissions + other future settings
  -- suggested keys:
  --   permissions: {calendar,notifications,email,health,location,contacts,browsing,appUsage}
  --   joy_selections: string[]
  --   joy_custom_options: string[]
  --   drain_selections: string[]
  --   drain_custom_options: string[]
  --   focus_style: string
  --   coach_persona: string
  --   morning_mindset: string
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If tm.profiles already existed (common in this repo), ensure the required columns exist.
alter table tm.profiles add column if not exists role text null;
alter table tm.profiles add column if not exists mission text null;
alter table tm.profiles add column if not exists ideal_work_day time null;
alter table tm.profiles add column if not exists ideal_sabbath time null;
alter table tm.profiles add column if not exists full_name text null;
alter table tm.profiles add column if not exists birthday date null;
alter table tm.profiles add column if not exists timezone text null;
alter table tm.profiles add column if not exists meta jsonb;

-- Backfill defaults / constraints (safe if rerun)
update tm.profiles set timezone = coalesce(timezone, 'UTC') where timezone is null;
update tm.profiles set meta = '{}'::jsonb where meta is null;
alter table tm.profiles alter column timezone set default 'UTC';
alter table tm.profiles alter column timezone set not null;
alter table tm.profiles alter column meta set default '{}'::jsonb;
alter table tm.profiles alter column meta set not null;

drop trigger if exists update_tm_profiles_updated_at on tm.profiles;
create trigger update_tm_profiles_updated_at
before update on tm.profiles
for each row execute function public.update_updated_at_column();

alter table tm.profiles enable row level security;

-- NOTE: we only CREATE policies if missing (no dropping/replacing).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profiles' and policyname = 'tm.profiles: select own'
  ) then
    execute $$create policy "tm.profiles: select own" on tm.profiles for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profiles' and policyname = 'tm.profiles: insert own'
  ) then
    execute $$create policy "tm.profiles: insert own" on tm.profiles for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profiles' and policyname = 'tm.profiles: update own'
  ) then
    execute $$create policy "tm.profiles: update own" on tm.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- tm.profile_values
-- Onboarding screen: "demo-overview-values" + future values work
-- -----------------------------------------------------------------------------
create table if not exists tm.profile_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value_label text not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists tm_profile_values_user_rank_uniq on tm.profile_values(user_id, rank);
create unique index if not exists tm_profile_values_user_label_uniq on tm.profile_values(user_id, value_label);
create index if not exists tm_profile_values_user_idx on tm.profile_values(user_id);

alter table tm.profile_values enable row level security;

-- NOTE: we only CREATE policies if missing (no dropping/replacing).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profile_values' and policyname = 'tm.profile_values: select own'
  ) then
    execute $$create policy "tm.profile_values: select own" on tm.profile_values for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profile_values' and policyname = 'tm.profile_values: insert own'
  ) then
    execute $$create policy "tm.profile_values: insert own" on tm.profile_values for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profile_values' and policyname = 'tm.profile_values: update own'
  ) then
    execute $$create policy "tm.profile_values: update own" on tm.profile_values for update using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'profile_values' and policyname = 'tm.profile_values: delete own'
  ) then
    execute $$create policy "tm.profile_values: delete own" on tm.profile_values for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- tm.events
-- Onboarding screen: "goals" (goals + initiatives are stored as events of type 'goal')
-- Also supports calendar/event storage later.
-- -----------------------------------------------------------------------------
create table if not exists tm.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- In app code today we use: type + title + meta
  type text not null,
  title text not null,
  description text null,

  scheduled_start timestamptz null,
  scheduled_end timestamptz null,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tm_events_user_type_idx on tm.events(user_id, type);
create index if not exists tm_events_user_created_idx on tm.events(user_id, created_at desc);

drop trigger if exists update_tm_events_updated_at on tm.events;
create trigger update_tm_events_updated_at
before update on tm.events
for each row execute function public.update_updated_at_column();

alter table tm.events enable row level security;

drop policy if exists "tm.events: select own" on tm.events;
create policy "tm.events: select own"
on tm.events for select
using (auth.uid() = user_id);

drop policy if exists "tm.events: insert own" on tm.events;
create policy "tm.events: insert own"
on tm.events for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.events: update own" on tm.events;
create policy "tm.events: update own"
on tm.events for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.events: delete own" on tm.events;
create policy "tm.events: delete own"
on tm.events for delete
using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- tm.routines + tm.routine_items
-- Onboarding screen: "build-routine"
-- -----------------------------------------------------------------------------
create table if not exists tm.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'morning',
  wake_time time null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

drop trigger if exists update_tm_routines_updated_at on tm.routines;
create trigger update_tm_routines_updated_at
before update on tm.routines
for each row execute function public.update_updated_at_column();

alter table tm.routines enable row level security;

drop policy if exists "tm.routines: select own" on tm.routines;
create policy "tm.routines: select own"
on tm.routines for select
using (auth.uid() = user_id);

drop policy if exists "tm.routines: insert own" on tm.routines;
create policy "tm.routines: insert own"
on tm.routines for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.routines: update own" on tm.routines;
create policy "tm.routines: update own"
on tm.routines for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.routines: delete own" on tm.routines;
create policy "tm.routines: delete own"
on tm.routines for delete
using (auth.uid() = user_id);

create table if not exists tm.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references tm.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  title text not null,
  minutes integer not null check (minutes > 0),
  icon_key text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, position)
);

create index if not exists tm_routine_items_routine_idx on tm.routine_items(routine_id, position);
create index if not exists tm_routine_items_user_idx on tm.routine_items(user_id);

drop trigger if exists update_tm_routine_items_updated_at on tm.routine_items;
create trigger update_tm_routine_items_updated_at
before update on tm.routine_items
for each row execute function public.update_updated_at_column();

alter table tm.routine_items enable row level security;

drop policy if exists "tm.routine_items: select own" on tm.routine_items;
create policy "tm.routine_items: select own"
on tm.routine_items for select
using (auth.uid() = user_id);

drop policy if exists "tm.routine_items: insert own" on tm.routine_items;
create policy "tm.routine_items: insert own"
on tm.routine_items for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.routine_items: update own" on tm.routine_items;
create policy "tm.routine_items: update own"
on tm.routine_items for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.routine_items: delete own" on tm.routine_items;
create policy "tm.routine_items: delete own"
on tm.routine_items for delete
using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- tm.ideal_day_templates + tm.ideal_day_categories (+ custom per-day overrides)
-- Onboarding screen: "ideal-day"
-- -----------------------------------------------------------------------------
create table if not exists tm.ideal_day_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_type text not null check (day_type in ('weekdays', 'saturday', 'sunday')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_type)
);

drop trigger if exists update_tm_ideal_day_templates_updated_at on tm.ideal_day_templates;
create trigger update_tm_ideal_day_templates_updated_at
before update on tm.ideal_day_templates
for each row execute function public.update_updated_at_column();

alter table tm.ideal_day_templates enable row level security;

drop policy if exists "tm.ideal_day_templates: select own" on tm.ideal_day_templates;
create policy "tm.ideal_day_templates: select own"
on tm.ideal_day_templates for select
using (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_templates: insert own" on tm.ideal_day_templates;
create policy "tm.ideal_day_templates: insert own"
on tm.ideal_day_templates for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_templates: update own" on tm.ideal_day_templates;
create policy "tm.ideal_day_templates: update own"
on tm.ideal_day_templates for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_templates: delete own" on tm.ideal_day_templates;
create policy "tm.ideal_day_templates: delete own"
on tm.ideal_day_templates for delete
using (auth.uid() = user_id);

create table if not exists tm.ideal_day_categories (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references tm.ideal_day_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null,
  name text not null,
  minutes integer not null check (minutes >= 0),
  max_minutes integer not null default 0 check (max_minutes >= 0),
  color text null,
  icon_name text null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, category_key)
);

create index if not exists tm_ideal_day_categories_template_idx on tm.ideal_day_categories(template_id, position);
create index if not exists tm_ideal_day_categories_user_idx on tm.ideal_day_categories(user_id);

drop trigger if exists update_tm_ideal_day_categories_updated_at on tm.ideal_day_categories;
create trigger update_tm_ideal_day_categories_updated_at
before update on tm.ideal_day_categories
for each row execute function public.update_updated_at_column();

alter table tm.ideal_day_categories enable row level security;

drop policy if exists "tm.ideal_day_categories: select own" on tm.ideal_day_categories;
create policy "tm.ideal_day_categories: select own"
on tm.ideal_day_categories for select
using (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_categories: insert own" on tm.ideal_day_categories;
create policy "tm.ideal_day_categories: insert own"
on tm.ideal_day_categories for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_categories: update own" on tm.ideal_day_categories;
create policy "tm.ideal_day_categories: update own"
on tm.ideal_day_categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_categories: delete own" on tm.ideal_day_categories;
create policy "tm.ideal_day_categories: delete own"
on tm.ideal_day_categories for delete
using (auth.uid() = user_id);

-- Custom per-day overrides (0=Mon ... 6=Sun) for "custom" mode
create table if not exists tm.ideal_day_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_of_week)
);

drop trigger if exists update_tm_ideal_day_overrides_updated_at on tm.ideal_day_overrides;
create trigger update_tm_ideal_day_overrides_updated_at
before update on tm.ideal_day_overrides
for each row execute function public.update_updated_at_column();

alter table tm.ideal_day_overrides enable row level security;

drop policy if exists "tm.ideal_day_overrides: select own" on tm.ideal_day_overrides;
create policy "tm.ideal_day_overrides: select own"
on tm.ideal_day_overrides for select
using (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_overrides: insert own" on tm.ideal_day_overrides;
create policy "tm.ideal_day_overrides: insert own"
on tm.ideal_day_overrides for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_overrides: update own" on tm.ideal_day_overrides;
create policy "tm.ideal_day_overrides: update own"
on tm.ideal_day_overrides for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_overrides: delete own" on tm.ideal_day_overrides;
create policy "tm.ideal_day_overrides: delete own"
on tm.ideal_day_overrides for delete
using (auth.uid() = user_id);

create table if not exists tm.ideal_day_override_categories (
  id uuid primary key default gen_random_uuid(),
  override_id uuid not null references tm.ideal_day_overrides(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_key text not null,
  name text not null,
  minutes integer not null check (minutes >= 0),
  max_minutes integer not null default 0 check (max_minutes >= 0),
  color text null,
  icon_name text null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (override_id, category_key)
);

create index if not exists tm_ideal_day_override_categories_override_idx on tm.ideal_day_override_categories(override_id, position);
create index if not exists tm_ideal_day_override_categories_user_idx on tm.ideal_day_override_categories(user_id);

drop trigger if exists update_tm_ideal_day_override_categories_updated_at on tm.ideal_day_override_categories;
create trigger update_tm_ideal_day_override_categories_updated_at
before update on tm.ideal_day_override_categories
for each row execute function public.update_updated_at_column();

alter table tm.ideal_day_override_categories enable row level security;

drop policy if exists "tm.ideal_day_override_categories: select own" on tm.ideal_day_override_categories;
create policy "tm.ideal_day_override_categories: select own"
on tm.ideal_day_override_categories for select
using (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_override_categories: insert own" on tm.ideal_day_override_categories;
create policy "tm.ideal_day_override_categories: insert own"
on tm.ideal_day_override_categories for insert
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_override_categories: update own" on tm.ideal_day_override_categories;
create policy "tm.ideal_day_override_categories: update own"
on tm.ideal_day_override_categories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tm.ideal_day_override_categories: delete own" on tm.ideal_day_override_categories;
create policy "tm.ideal_day_override_categories: delete own"
on tm.ideal_day_override_categories for delete
using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Grants (authenticated)
-- -----------------------------------------------------------------------------
grant usage on schema tm to authenticated;
grant select, insert, update, delete on tm.profiles to authenticated;
grant select, insert, update, delete on tm.profile_values to authenticated;
grant select, insert, update, delete on tm.events to authenticated;
grant select, insert, update, delete on tm.routines to authenticated;
grant select, insert, update, delete on tm.routine_items to authenticated;
grant select, insert, update, delete on tm.ideal_day_templates to authenticated;
grant select, insert, update, delete on tm.ideal_day_categories to authenticated;
grant select, insert, update, delete on tm.ideal_day_overrides to authenticated;
grant select, insert, update, delete on tm.ideal_day_override_categories to authenticated;





