-- =============================================================================
-- User Location Mappings (location to activity inference)
-- Maps location addresses to activity names for actual timeline derivation
-- =============================================================================

create table if not exists tm.location_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_address text not null,
  activity_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure unique mappings per user per location
  unique (user_id, location_address)
);

-- Create index for fast lookups by user
create index if not exists idx_location_mappings_user_id on tm.location_mappings(user_id);

-- Create index for location address lookups
create index if not exists idx_location_mappings_location on tm.location_mappings(user_id, location_address);

-- Trigger to auto-update updated_at
drop trigger if exists update_tm_location_mappings_updated_at on tm.location_mappings;
create trigger update_tm_location_mappings_updated_at
before update on tm.location_mappings
for each row execute function public.update_updated_at_column();

-- Enable row level security
alter table tm.location_mappings enable row level security;

-- RLS policies for user data isolation
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='location_mappings' and policyname='tm.location_mappings: select own'
  ) then
    execute $$create policy "tm.location_mappings: select own"
      on tm.location_mappings for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='location_mappings' and policyname='tm.location_mappings: insert own'
  ) then
    execute $$create policy "tm.location_mappings: insert own"
      on tm.location_mappings for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='location_mappings' and policyname='tm.location_mappings: update own'
  ) then
    execute $$create policy "tm.location_mappings: update own"
      on tm.location_mappings for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='location_mappings' and policyname='tm.location_mappings: delete own'
  ) then
    execute $$create policy "tm.location_mappings: delete own"
      on tm.location_mappings for delete using (auth.uid() = user_id)$$;
  end if;
end $$;
