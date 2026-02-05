-- =============================================================================
-- User App Category Overrides (learning from corrections)
-- =============================================================================

create table if not exists tm.user_app_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_key text not null,
  app_name text null,
  category text not null,
  confidence numeric not null default 0.6,
  sample_count integer not null default 1,
  last_corrected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, app_key),
  constraint user_app_categories_confidence_chk check (confidence >= 0 and confidence <= 1),
  constraint user_app_categories_sample_count_chk check (sample_count >= 0)
);

drop trigger if exists update_tm_user_app_categories_updated_at on tm.user_app_categories;
create trigger update_tm_user_app_categories_updated_at
before update on tm.user_app_categories
for each row execute function public.update_updated_at_column();

alter table tm.user_app_categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_app_categories' and policyname='tm.user_app_categories: select own'
  ) then
    execute $$create policy "tm.user_app_categories: select own"
      on tm.user_app_categories for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_app_categories' and policyname='tm.user_app_categories: insert own'
  ) then
    execute $$create policy "tm.user_app_categories: insert own"
      on tm.user_app_categories for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_app_categories' and policyname='tm.user_app_categories: update own'
  ) then
    execute $$create policy "tm.user_app_categories: update own"
      on tm.user_app_categories for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='user_app_categories' and policyname='tm.user_app_categories: delete own'
  ) then
    execute $$create policy "tm.user_app_categories: delete own"
      on tm.user_app_categories for delete using (auth.uid() = user_id)$$;
  end if;
end $$;
