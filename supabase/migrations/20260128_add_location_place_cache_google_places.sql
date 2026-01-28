-- Google Places cache for location naming
-- Purpose: map hourly location centroids (geohash7) -> human-readable place name (e.g. "Starbucks")
-- Notes:
-- - Cached per-user for privacy (avoid sharing place history across users).
-- - TTL-based; edge function writes-through cache and refreshes on expiry.
-- - Joined into tm.location_hourly so mobile can display names without extra queries.

create schema if not exists tm;
create extension if not exists postgis with schema extensions;

-- -----------------------------------------------------------------------------
-- Cache table: per-user geohash7 -> Google Places name
-- -----------------------------------------------------------------------------

create table if not exists tm.location_place_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Coordinates used for the lookup (typically an hourly centroid)
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),

  -- Generated point + geohash key for joining to tm.location_hourly
  geom geography(point, 4326)
    generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  geohash7 text
    generated always as (st_geohash(geom::geometry, 7)) stored,

  -- Google Places metadata (Nearby Search)
  google_place_id text null,
  place_name text not null,
  place_vicinity text null,
  place_types jsonb null,

  source text not null default 'google_places_nearby'
    check (source in ('google_places_nearby')),

  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now()
);

-- One active cached name per user per geohash7 cell.
create unique index if not exists location_place_cache_user_geohash7
  on tm.location_place_cache (user_id, geohash7);

create index if not exists location_place_cache_user_expires_at
  on tm.location_place_cache (user_id, expires_at desc);

create index if not exists location_place_cache_geom_gist
  on tm.location_place_cache using gist (geom);

alter table tm.location_place_cache enable row level security;

do $$
begin
  -- Read own rows
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'location_place_cache' and policyname = 'location_place_cache_select_own'
  ) then
    create policy location_place_cache_select_own
      on tm.location_place_cache
      for select
      using (auth.uid() = user_id);
  end if;

  -- Insert own rows
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'location_place_cache' and policyname = 'location_place_cache_insert_own'
  ) then
    create policy location_place_cache_insert_own
      on tm.location_place_cache
      for insert
      with check (auth.uid() = user_id);
  end if;

  -- Update own rows (required for upsert)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'location_place_cache' and policyname = 'location_place_cache_update_own'
  ) then
    create policy location_place_cache_update_own
      on tm.location_place_cache
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Update hourly view to include cached Google place name
-- -----------------------------------------------------------------------------

create or replace view tm.location_hourly as
with hourly as (
  select
    user_id,
    date_trunc('hour', recorded_at) as hour_start,
    count(*) as sample_count,
    avg(accuracy_m) as avg_accuracy_m,
    st_centroid(st_collect(geom::geometry)) as centroid_geom,
    array_agg(geom) as geoms
  from tm.location_samples
  group by 1, 2
)
select
  h.user_id,
  h.hour_start,
  h.sample_count,
  h.avg_accuracy_m,
  (h.centroid_geom::geography) as centroid,
  st_geohash(h.centroid_geom, 7) as geohash7,
  (
    select max(st_distance(g, h.centroid_geom::geography))
    from unnest(h.geoms) as g
  ) as radius_m,
  place_match.id as place_id,
  place_match.label as place_label,
  place_match.category as place_category,
  google_match.google_place_id as google_place_id,
  google_match.place_name as google_place_name,
  google_match.place_vicinity as google_place_vicinity,
  google_match.place_types as google_place_types
from hourly h
left join lateral (
  select p.id, p.label, p.category
  from tm.user_places p
  where p.user_id = h.user_id
    and st_dwithin(p.center, h.centroid_geom::geography, p.radius_m)
  order by p.radius_m asc
  limit 1
) place_match on true
left join lateral (
  select c.google_place_id, c.place_name, c.place_vicinity, c.place_types
  from tm.location_place_cache c
  where c.user_id = h.user_id
    and c.geohash7 = st_geohash(h.centroid_geom, 7)
    and c.expires_at > now()
  order by c.fetched_at desc
  limit 1
) google_match on true;

-- -----------------------------------------------------------------------------
-- Grants (authenticated)
-- -----------------------------------------------------------------------------
grant usage on schema tm to authenticated;
grant select, insert, update on tm.location_place_cache to authenticated;
grant select on tm.location_hourly to authenticated;

