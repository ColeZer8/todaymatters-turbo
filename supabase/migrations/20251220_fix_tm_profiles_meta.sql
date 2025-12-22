-- Ensure tm.profiles has meta jsonb and refresh PostgREST schema cache.
-- This is intentionally idempotent so it can be safely rerun on any environment.

create schema if not exists tm;

-- If tm.profiles was created previously without meta, add it.
alter table if exists tm.profiles add column if not exists meta jsonb;

-- Ensure meta is always present.
update tm.profiles set meta = '{}'::jsonb where meta is null;
alter table if exists tm.profiles alter column meta set default '{}'::jsonb;
alter table if exists tm.profiles alter column meta set not null;

-- Ensure timezone is always present (matches app expectations).
alter table if exists tm.profiles add column if not exists timezone text;
update tm.profiles set timezone = coalesce(timezone, 'UTC') where timezone is null;
alter table if exists tm.profiles alter column timezone set default 'UTC';
alter table if exists tm.profiles alter column timezone set not null;

-- Re-apply grants (safe).
grant usage on schema tm to authenticated;
grant select, insert, update, delete on tm.profiles to authenticated;

-- Ask PostgREST to reload schema cache (best-effort; ignore errors if not permitted).
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  -- no-op
end $$;

