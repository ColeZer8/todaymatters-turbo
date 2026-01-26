-- =============================================================================
-- Daily Big 3 Priorities
-- Stores the user's 3 daily priorities with optional category links.
-- One set of Big 3 per user per day.
-- =============================================================================

create table if not exists tm.daily_big3 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  priority_1 text not null default '',
  priority_2 text not null default '',
  priority_3 text not null default '',
  category_id_1 uuid null references tm.activity_categories(id) on delete set null,
  category_id_2 uuid null references tm.activity_categories(id) on delete set null,
  category_id_3 uuid null references tm.activity_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_big3_unique_user_date unique (user_id, date)
);

-- Indexes for common queries
create index if not exists daily_big3_user_id
  on tm.daily_big3 (user_id);
create index if not exists daily_big3_user_date
  on tm.daily_big3 (user_id, date);

-- Updated-at trigger
drop trigger if exists update_tm_daily_big3_updated_at on tm.daily_big3;
create trigger update_tm_daily_big3_updated_at
before update on tm.daily_big3
for each row execute function public.update_updated_at_column();

-- Enable RLS
alter table tm.daily_big3 enable row level security;

-- RLS policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='daily_big3' and policyname='tm.daily_big3: select own'
  ) then
    execute $$create policy "tm.daily_big3: select own"
      on tm.daily_big3 for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='daily_big3' and policyname='tm.daily_big3: insert own'
  ) then
    execute $$create policy "tm.daily_big3: insert own"
      on tm.daily_big3 for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='daily_big3' and policyname='tm.daily_big3: update own'
  ) then
    execute $$create policy "tm.daily_big3: update own"
      on tm.daily_big3 for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='daily_big3' and policyname='tm.daily_big3: delete own'
  ) then
    execute $$create policy "tm.daily_big3: delete own"
      on tm.daily_big3 for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- Grant permissions
grant select, insert, update, delete on tm.daily_big3 to authenticated;

-- =============================================================================
-- Add big3_enabled preference column to user_data_preferences
-- =============================================================================

alter table tm.user_data_preferences
  add column if not exists big3_enabled boolean not null default false;
