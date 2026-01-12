-- iOS Location Samples (raw) + Hourly Aggregation
-- Purpose: compare planned schedule vs actual day (meeting vs lunch vs commute) using venue-level location traces.
--
-- Notes:
-- - Uses a dedupe key so the client can safely retry uploads.
-- - Stores lat/lng as numeric columns and a generated PostGIS geography point for spatial queries.
-- - RLS is enabled; users can insert/select only their own rows.

create schema if not exists tm;

create extension if not exists postgis with schema extensions;

create table if not exists tm.location_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The moment the OS reported this sample.
  recorded_at timestamptz not null,

  -- Raw coordinates (client inserts these).
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),

  -- Generated point for PostGIS queries (server computes this).
  geom geography(point, 4326)
    generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,

  accuracy_m real null check (accuracy_m >= 0),
  altitude_m real null,
  speed_mps real null check (speed_mps >= 0),
  heading_deg real null check (heading_deg >= 0 and heading_deg < 360),
  is_mocked boolean null,

  -- For now we only ingest iOS background task samples. (Android will use the same table later.)
  source text not null default 'background' check (source in ('background')),

  -- Client-generated stable key to dedupe retries.
  dedupe_key text not null,

  -- Optional debug payload (keep small).
  raw jsonb null,

  created_at timestamptz not null default now()
);

create unique index if not exists location_samples_user_dedupe_key
  on tm.location_samples (user_id, dedupe_key);

create index if not exists location_samples_user_recorded_at_desc
  on tm.location_samples (user_id, recorded_at desc);

create index if not exists location_samples_geom_gist
  on tm.location_samples using gist (geom);

alter table tm.location_samples enable row level security;

do $$
begin
  -- Read own rows
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'location_samples' and policyname = 'location_samples_select_own'
  ) then
    create policy location_samples_select_own
      on tm.location_samples
      for select
      using (auth.uid() = user_id);
  end if;

  -- Insert own rows
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'location_samples' and policyname = 'location_samples_insert_own'
  ) then
    create policy location_samples_insert_own
      on tm.location_samples
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Optional: user-defined labeled places (office/home/gym/etc.), to map hourly centroids to meaning.
create table if not exists tm.user_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  category text null, -- e.g. 'home', 'office', 'restaurant', 'gym'
  radius_m real not null default 150 check (radius_m > 0),
  center geography(point, 4326) not null,
  created_at timestamptz not null default now()
);

create index if not exists user_places_user_id
  on tm.user_places (user_id);

create index if not exists user_places_center_gist
  on tm.user_places using gist (center);

alter table tm.user_places enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'user_places' and policyname = 'user_places_select_own'
  ) then
    create policy user_places_select_own
      on tm.user_places
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'user_places' and policyname = 'user_places_insert_own'
  ) then
    create policy user_places_insert_own
      on tm.user_places
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'user_places' and policyname = 'user_places_update_own'
  ) then
    create policy user_places_update_own
      on tm.user_places
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'tm' and tablename = 'user_places' and policyname = 'user_places_delete_own'
  ) then
    create policy user_places_delete_own
      on tm.user_places
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Hour-by-hour summary: centroid + sample_count + radius, with optional place label.
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
  place_match.category as place_category
from hourly h
left join lateral (
  select p.id, p.label, p.category
  from tm.user_places p
  where p.user_id = h.user_id
    and st_dwithin(p.center, h.centroid_geom::geography, p.radius_m)
  order by p.radius_m asc
  limit 1
) place_match on true;

-- -----------------------------------------------------------------------------
-- Grants (authenticated)
-- -----------------------------------------------------------------------------
grant usage on schema tm to authenticated;
grant select, insert on tm.location_samples to authenticated;
grant select, insert, update, delete on tm.user_places to authenticated;
grant select on tm.location_hourly to authenticated;

