-- =============================================================================
-- Add calendar event types to enum(s) used by tm.events.type
-- Purpose:
--   Fix runtime errors like:
--     invalid input value for enum event_type: "calendar_planned"
-- 
-- Note: The tm.events.type column is defined as TEXT in migrations, but
--       hosted Supabase may have been manually changed to use an enum.
--       This migration handles both cases.
-- =============================================================================

do $$
declare
  col_type text;
  enum_name text;
  enum_schema text;
begin
  -- First, check what type the column actually is in the hosted DB
  select 
    pg_catalog.format_type(a.atttypid, a.atttypmod),
    t.typname,
    n.nspname
  into col_type, enum_name, enum_schema
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_type t on t.oid = a.atttypid
  where n.nspname = 'tm'
    and c.relname = 'events'
    and a.attname = 'type'
    and not a.attisdropped;

  -- If column is TEXT, no migration needed - it accepts any string
  if col_type = 'text' then
    raise notice 'tm.events.type is TEXT - no enum migration needed. Calendar events should work now.';
    return;
  end if;

  -- If column uses an enum, add the calendar values
  if enum_name is not null then
    raise notice 'tm.events.type uses enum %.% - adding calendar_planned and calendar_actual', enum_schema, enum_name;
    
    -- Add values to the enum (works for both public.event_type and tm.event_type)
    execute format('alter type %I.%I add value if not exists %L', enum_schema, enum_name, 'calendar_planned');
    execute format('alter type %I.%I add value if not exists %L', enum_schema, enum_name, 'calendar_actual');
    
    raise notice '✅ Added calendar_planned and calendar_actual to enum';
    return;
  end if;

  -- Fallback: check for common enum names and extend them
  -- Check public.event_type
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'event_type'
  ) then
    execute $$alter type public.event_type add value if not exists 'calendar_planned'$$;
    execute $$alter type public.event_type add value if not exists 'calendar_actual'$$;
    raise notice '✅ Extended public.event_type with calendar values';
  end if;

  -- Check tm.event_type
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tm' and t.typname = 'event_type'
  ) then
    execute $$alter type tm.event_type add value if not exists 'calendar_planned'$$;
    execute $$alter type tm.event_type add value if not exists 'calendar_actual'$$;
    raise notice '✅ Extended tm.event_type with calendar values';
  end if;

  -- Check tm.tm_event_type (back-compat)
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'tm' and t.typname = 'tm_event_type'
  ) then
    execute $$alter type tm.tm_event_type add value if not exists 'calendar_planned'$$;
    execute $$alter type tm.tm_event_type add value if not exists 'calendar_actual'$$;
    raise notice '✅ Extended tm.tm_event_type with calendar values';
  end if;
end $$;


