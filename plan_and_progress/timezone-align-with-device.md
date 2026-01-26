# Timezone: align app + Supabase with device timezone

- Status: Completed
- Owner: cursor agent
- Started: 2026-01-26
- Completed: 2026-01-26

## Objective

Ensure all “day” grouping and time display logic matches the user’s phone timezone, while continuing to store timestamps in UTC in Supabase.

## Plan

1. Audit timezone/day-boundary code paths (calendar, health, screen time, profiles).
2. Standardize date helpers: “format local YYYY-MM-DD”, “local day start/end to UTC ISO”.
3. Sync `tm.profiles.timezone` when device timezone changes.

## Done Criteria

- Local-day keys (`YYYY-MM-DD`) are derived from device local time, not UTC.
- Supabase reads/writes continue to use ISO timestamps (UTC), but day ranges are computed from local day boundaries.
- Device timezone changes are reflected in `tm.profiles.timezone` without manual action.

## Progress

- 2026-01-26: Identified UTC-day bug patterns (`toISOString().slice(0, 10)` / `split('T')[0]`) and existing local-day range code in `calendar-events` and evidence fetchers.

## Verification

- `pnpm --filter mobile lint` (pass)
- `pnpm --filter mobile check-types` (fails due to pre-existing TypeScript errors unrelated to timezone changes)

## Outcomes

- Standardized “local YYYY-MM-DD” derivation to always use device local time, avoiding UTC-day drift.
- Synced `tm.profiles.timezone` from device timezone when it changes (best-effort, non-blocking).

## Follow-ups

- Consider adding a small regression unit test for local-date formatting across timezones (if feasible in RN/Jest env).
