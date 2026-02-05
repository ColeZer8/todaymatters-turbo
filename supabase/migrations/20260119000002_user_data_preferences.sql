-- =============================================================================
-- User Data Preferences (personalization)
-- =============================================================================

create table if not exists tm.user_data_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_categories jsonb null,
  sleep_preferences jsonb null,
  gap_filling_preferences jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists update_tm_user_data_preferences_updated_at on tm.user_data_preferences;
create trigger update_tm_user_data_preferences_updated_at
before update on tm.user_data_preferences
for each row execute function public.update_updated_at_column();

alter table tm.user_data_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_data_preferences' and policyname='tm.user_data_preferences: select own'
  ) then
    execute $$create policy "tm.user_data_preferences: select own"
      on tm.user_data_preferences for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_data_preferences' and policyname='tm.user_data_preferences: insert own'
  ) then
    execute $$create policy "tm.user_data_preferences: insert own"
      on tm.user_data_preferences for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_data_preferences' and policyname='tm.user_data_preferences: update own'
  ) then
    execute $$create policy "tm.user_data_preferences: update own"
      on tm.user_data_preferences for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_data_preferences' and policyname='tm.user_data_preferences: delete own'
  ) then
    execute $$create policy "tm.user_data_preferences: delete own"
      on tm.user_data_preferences for delete using (auth.uid() = user_id)$$;
  end if;
end $$;
