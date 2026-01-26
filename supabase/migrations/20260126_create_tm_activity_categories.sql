-- =============================================================================
-- Hierarchical Activity Categories
-- Replaces flat EventCategory enum with user-owned Category → Subcategory → Sub-subcategory tree
-- =============================================================================

create table if not exists tm.activity_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid null references tm.activity_categories(id) on delete cascade,
  name text not null,
  icon text null,
  color text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activity_categories_unique_name_per_level unique (user_id, parent_id, name)
);

-- Indexes for common queries
create index if not exists activity_categories_user_id
  on tm.activity_categories (user_id);
create index if not exists activity_categories_parent_id
  on tm.activity_categories (parent_id);
create index if not exists activity_categories_user_sort
  on tm.activity_categories (user_id, parent_id, sort_order);

-- Updated-at trigger
drop trigger if exists update_tm_activity_categories_updated_at on tm.activity_categories;
create trigger update_tm_activity_categories_updated_at
before update on tm.activity_categories
for each row execute function public.update_updated_at_column();

-- Enable RLS
alter table tm.activity_categories enable row level security;

-- RLS policies (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_categories' and policyname='tm.activity_categories: select own'
  ) then
    execute $$create policy "tm.activity_categories: select own"
      on tm.activity_categories for select using (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_categories' and policyname='tm.activity_categories: insert own'
  ) then
    execute $$create policy "tm.activity_categories: insert own"
      on tm.activity_categories for insert with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_categories' and policyname='tm.activity_categories: update own'
  ) then
    execute $$create policy "tm.activity_categories: update own"
      on tm.activity_categories for update
      using (auth.uid() = user_id) with check (auth.uid() = user_id)$$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='tm' and tablename='activity_categories' and policyname='tm.activity_categories: delete own'
  ) then
    execute $$create policy "tm.activity_categories: delete own"
      on tm.activity_categories for delete using (auth.uid() = user_id)$$;
  end if;
end $$;

-- Grant permissions
grant select, insert, update, delete on tm.activity_categories to authenticated;

-- =============================================================================
-- Seed function: creates default top-level categories for a new user.
-- Called from application code after user creation (not auto-triggered).
-- Can also be called idempotently — skips if categories already exist.
-- =============================================================================
create or replace function tm.seed_default_activity_categories(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only seed if user has no categories yet
  if exists (select 1 from tm.activity_categories where user_id = p_user_id limit 1) then
    return;
  end if;

  insert into tm.activity_categories (user_id, parent_id, name, icon, sort_order)
  values
    (p_user_id, null, 'Faith',           '🙏', 0),
    (p_user_id, null, 'Family',          '👨‍👩‍👧‍👦', 1),
    (p_user_id, null, 'Work',            '💼', 2),
    (p_user_id, null, 'Health',          '💪', 3),
    (p_user_id, null, 'Personal Growth', '📚', 4),
    (p_user_id, null, 'Finances',        '💰', 5),
    (p_user_id, null, 'Other',           '📦', 6);
end;
$$;
