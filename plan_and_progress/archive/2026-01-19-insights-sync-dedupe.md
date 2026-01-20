# Insights Sync Dedupe

- Status: Completed
- Owner: codex
- Started: 2026-01-19
- Completed: 2026-01-19

## Objective

Prevent duplicate `screen_time_app_daily` inserts by deduping app rows before sync.

## Plan

1. Add a dedupe helper for app-daily rows in the screen time sync service.
2. Apply it to iOS and Android app-daily inserts.
3. Verify no unique-constraint errors are thrown during sync.

## Done Criteria

- App-daily rows are deduped by `app_id` before insert for iOS and Android.
- Sync no longer triggers `tm_screen_time_app_daily_unique` violations for duplicate app rows.

## Progress

- 2026-01-19: Added app-daily dedupe in screen time sync service for iOS/Android.

## Verification

- Not run (not requested).

## Outcomes

- Added app-daily row dedupe before insert to avoid unique constraint violations.

## Follow-ups

- None.
