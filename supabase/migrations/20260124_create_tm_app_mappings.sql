-- =============================================================================
-- User App Mappings (app to activity inference)
-- Maps app names to activity types and distraction flags for actual timeline derivation
-- =============================================================================

create table if not exists tm.app_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_name text not null,
  activity_type text not null,
  is_distraction boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure unique mappings per user per app
  unique (user_id, app_name)
);

-- Create index for fast lookups by user
create index if not exists idx_app_mappings_user_id on tm.app_mappings(user_id);

-- Create index for app name lookups
create index if not exists idx_app_mappings_app_name on tm.app_mappings(user_id, app_name);

-- Trigger to auto-update updated_at
drop trigger if exists update_tm_app_mappings_updated_at on tm.app_mappings;
create trigger update_tm_app_mappings_updated_at
before update on tm.app_mappings
for each row execute function public.update_updated_at_column();

-- Enable row level security
alter table tm.app_mappings enable row level security;

-- RLS policies for user data isolation
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='app_mappings' and policyname='tm.app_mappings: select own'
  ) then
    execute $$create policy "tm.app_mappings: select own"
      on tm.app_mappings for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='app_mappings' and policyname='tm.app_mappings: insert own'
  ) then
    execute $$create policy "tm.app_mappings: insert own"
      on tm.app_mappings for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='app_mappings' and policyname='tm.app_mappings: update own'
  ) then
    execute $$create policy "tm.app_mappings: update own"
      on tm.app_mappings for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='app_mappings' and policyname='tm.app_mappings: delete own'
  ) then
    execute $$create policy "tm.app_mappings: delete own"
      on tm.app_mappings for delete using (auth.uid() = user_id)$$;
  end if;
end $$;
