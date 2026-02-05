-- Migration: Add category CHECK constraint to tm.user_app_categories
-- Description: Enforce allowed category values for user app categorization overrides
-- User Story: US-003
--
-- Note: The tm.user_app_categories table was created in 20260119_user_app_categories_learning.sql
-- This migration adds the CHECK constraint to enforce valid category values.

-- Add CHECK constraint on category column to enforce allowed values
-- The constraint is idempotent (do nothing if already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_app_categories_category_chk'
      and conrelid = 'tm.user_app_categories'::regclass
  ) then
    alter table tm.user_app_categories
      add constraint user_app_categories_category_chk
      check (category in ('work', 'social', 'entertainment', 'comms', 'utility', 'ignore'));
  end if;
end $$;

-- Add comment for documentation
comment on column tm.user_app_categories.category is 'Category classification: work, social, entertainment, comms, utility, or ignore';
