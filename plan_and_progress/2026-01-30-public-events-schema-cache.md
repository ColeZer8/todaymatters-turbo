# Public Events Schema Cache Error

- Status: In Progress
- Owner: assistant
- Started: 2026-01-30
- Completed: -

## Objective

Stop calendar sync from failing when `public.events` is not available, while
keeping `tm.events` required.

## Plan

1. Adjust calendar event fetch to skip `public.events` when missing.
2. Keep other Supabase errors as hard failures.
3. Note dev-only warning for visibility.

## Done Criteria

- Planned/actual events load without crashing when `public.events` is absent.
- Non-`public.events` errors still surface to callers.

## Progress

- 2026-01-30: Started update to ignore missing `public.events`.

## Verification

- Not run (no automated checks yet).

## Outcomes

- Updated calendar fetch to ignore missing `public.events`.

## Follow-ups

- Decide if the environment should provision `public.events` or remove the dependency entirely.
