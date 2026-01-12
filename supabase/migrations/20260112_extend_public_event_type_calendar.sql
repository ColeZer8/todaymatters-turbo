-- =============================================================================
-- Ensure public.event_type supports calendar_* values
--
-- Why:
--   In hosted DBs we’ve seen BOTH schemas using an enum called `event_type`.
--   Our app uses tm.events with types like `calendar_planned`/`calendar_actual`,
--   and some backends may write into public.events. If public.event_type is missing
--   these values, inserts/queries can fail with:
--     invalid input value for enum event_type: "calendar_actual"
-- =============================================================================

do $$
begin
  -- public.event_type
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'event_type'
  ) then
    execute $$alter type public.event_type add value if not exists 'calendar_planned'$$;
    execute $$alter type public.event_type add value if not exists 'calendar_actual'$$;
    raise notice '✅ Ensured public.event_type includes calendar_planned/calendar_actual';
  else
    raise notice 'ℹ️ public.event_type does not exist - nothing to do';
  end if;

  -- tm.event_type (keep symmetric; safe if already present)
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tm' and t.typname = 'event_type'
  ) then
    execute $$alter type tm.event_type add value if not exists 'calendar_planned'$$;
    execute $$alter type tm.event_type add value if not exists 'calendar_actual'$$;
    raise notice '✅ Ensured tm.event_type includes calendar_planned/calendar_actual';
  else
    raise notice 'ℹ️ tm.event_type does not exist - nothing to do';
  end if;
end $$;


