-- Add category_id to tm.user_places for linking places to hierarchical activity categories.
-- This allows users to assign a hierarchical category (from tm.activity_categories) when labeling a place.

alter table tm.user_places
  add column if not exists category_id uuid
    references tm.activity_categories (id) on delete set null;

create index if not exists user_places_category_id
  on tm.user_places (category_id);
