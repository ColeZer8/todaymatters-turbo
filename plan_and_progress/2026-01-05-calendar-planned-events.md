# Calendar Planned Events (Supabase + Mock Toggle)

- Status: In Progress
- Owner: Cole
- Started: 2026-01-05
- Completed: -

## Objective

Make the Planned calendar fully functional for daily use: add/edit/delete events persisted to Supabase. Provide a `.env` toggle to force mock calendar mode without overwriting real data.

## Plan

1. Add `EXPO_PUBLIC_USE_MOCK_CALENDAR` + a small config helper.
2. Create `tm.events`-backed planned calendar service (CRUD + fetch-by-day).
3. Refactor events store to support date-keyed planned events.
4. Wire `/comprehensive-calendar` to load by selected date + support mock toggle.
5. Wire `/add-event` + editor modal for create/edit/delete.
6. Verify manually + run lint/typecheck (mobile).

## Done Criteria

- Add a planned event for a selected day and see it in the Planned column.
- Events persist across app restart (loaded from Supabase).
- Edit (title/category/Big3) and delete planned events.
- `EXPO_PUBLIC_USE_MOCK_CALENDAR` switches between mock and real without touching DB.

## Progress

- 2026-01-05: Implemented Supabase-backed Planned calendar events (`tm.events` with `type="calendar_planned"`), date navigation, Add Event flow, and edit/delete via modal. Added `EXPO_PUBLIC_USE_MOCK_CALENDAR` to force mock calendar mode (without touching DB).

## Verification

- Typecheck: `pnpm --filter mobile check-types` (pass)
- Lint: `pnpm --filter mobile lint` (pass; warnings exist elsewhere in repo)
- Note: `pnpm check-types -- --filter=mobile` currently fails because Turbo forwards `--filter=mobile` into `tsc`.
- Manual QA (recommended):
  - Open Calendar tab (routes to `/comprehensive-calendar`)
  - Add event → confirm it appears in Planned column
  - Tap event → edit title/category/Big3, save; then delete
  - Restart app → confirm Supabase events reload
  - Toggle `EXPO_PUBLIC_USE_MOCK_CALENDAR=true` → confirm mock events appear and real events are hidden (DB untouched). Toggle back → real events return.

## Outcomes

- TBD

## Follow-ups

- Add recurrence + multi-day events.
- Expand actual-event capture (manual edits, writeback).

