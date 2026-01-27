# Fix location sample sync errors (heading constraint + network failures)

- Status: In Progress
- Owner: Cursor agent
- Started: 2026-01-13
- Completed: -

## Objective

Eliminate recurring console errors during background location tracking + sync by:

- Preventing invalid sample values (e.g. heading = -1/NaN) from violating Supabase DB constraints
- Handling network failures without throwing every flush interval (reduce log spam, keep queue intact)

## Plan

1. Audit current iOS/Android sample mapping + queue/flush pipeline
2. Normalize/sanitize sample payloads before enqueue + before upload
3. Improve Supabase error classification for network failures (case-insensitive) and wire backoff/throttled logging

## Done Criteria

- No `location_samples_heading_deg_check` constraint violations during normal app usage
- Flush failures due to offline/no-network do not throw repeatedly; queue is preserved and retries later
- iOS background task errors are logged as warnings with throttling (no red-screen spam in dev)

## Progress

- 2026-01-13: Investigated migration constraints + traced errors to `heading_deg` pass-through and network error classification.
- 2026-01-13: Added upload-time sanitation to drop/normalize invalid location sample fields before Supabase upsert.

## Verification

- `pnpm lint -- --filter=mobile`
- `pnpm check-types -- --filter=mobile`
- Manual QA: sign in, enable location, observe logs while toggling airplane mode / poor network.

## Outcomes

- Pending

## Follow-ups

- Consider adding lightweight UI indicator for “pending location uploads” in dev builds.
