-- =============================================================================
-- Activity Patterns (learned schedule patterns)
-- =============================================================================

create table if not exists tm.activity_patterns (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slots jsonb not null default '[]'::jsonb,
  window_start_ymd text null,
  window_end_ymd text null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists update_tm_activity_patterns_updated_at on tm.activity_patterns;
create trigger update_tm_activity_patterns_updated_at
before update on tm.activity_patterns
for each row execute function public.update_updated_at_column();

alter table tm.activity_patterns enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_patterns' and policyname='tm.activity_patterns: select own'
  ) then
    execute $$create policy "tm.activity_patterns: select own"
      on tm.activity_patterns for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_patterns' and policyname='tm.activity_patterns: insert own'
  ) then
    execute $$create policy "tm.activity_patterns: insert own"
      on tm.activity_patterns for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_patterns' and policyname='tm.activity_patterns: update own'
  ) then
    execute $$create policy "tm.activity_patterns: update own"
      on tm.activity_patterns for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_patterns' and policyname='tm.activity_patterns: delete own'
  ) then
    execute $$create policy "tm.activity_patterns: delete own"
      on tm.activity_patterns for delete using (auth.uid() = user_id)$$;
  end if;
end $$;
