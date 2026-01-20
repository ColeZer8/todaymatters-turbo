# Insights Sync Delete Policy

- Status: Completed
- Owner: codex
- Started: 2026-01-19
- Completed: 2026-01-19

## Objective

Ensure screen time sync can delete existing app rows without RLS blocking, preventing duplicate insert errors.

## Plan

1. Add delete policies for screen time app tables used by replace sync.
2. Optionally surface delete errors if RLS blocks them.
3. Document and archive the outcome.

## Done Criteria

- `tm.screen_time_app_daily`, `tm.screen_time_app_hourly`, and `tm.screen_time_app_sessions` allow delete for own rows.
- Sync no longer raises duplicate entry errors from failed deletes.

## Progress

- 2026-01-19: Added delete policies for screen time app tables and surfaced delete errors in sync.

## Verification

- Not run (not requested).

## Outcomes

- Added delete policies for screen time app tables and ensured delete errors are handled before inserts.

## Follow-ups

- None.
