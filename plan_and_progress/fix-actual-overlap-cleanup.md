# Fix Actual Overlap Cleanup

- Status: In Progress
- Owner: colezerman
- Started: 2026-01-27
- Completed: -

## Objective

Reduce derived actual overlap buildup and prevent cleanup timeouts.

## Plan

1. Locate overlap cleanup and deletion code paths.
2. Make cleanup deletes resilient to large batches.
3. Verify behavior with lint and spot checks.

## Done Criteria

- Derived overlap cleanup no longer times out on large days.
- Actual calendar no longer accumulates duplicate overlaps after cleanup.

## Progress

- 2026-01-27: Located cleanup in `comprehensive-calendar.tsx` and delete logic in Supabase service.
- 2026-01-27: Chunked derived actual deletion to avoid statement timeouts.
- 2026-01-27: Remove any overlapping actual events in display pipeline.

## Verification

- Not run yet (lints clean for edited file).

## Outcomes

- Pending.

## Follow-ups

- Confirm overlap generation logic if duplicates persist.
