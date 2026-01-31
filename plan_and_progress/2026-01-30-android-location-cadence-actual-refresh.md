# Android Location Cadence + Actual Calendar Refresh

- Status: In Progress
- Owner: assistant
- Started: 2026-01-30
- Completed: -

## Objective

Increase background location sample cadence and verify actual calendar refresh cadence
matches the expected 30-minute window processing.

## Plan

1. Inspect location sampling intervals and adjust for faster cadence.
2. Verify actual ingestion scheduler timing and refresh behavior.
3. Update relevant scheduling code if still running in near-real-time.

## Done Criteria

- Location sampling occurs more frequently than current baseline.
- Actual calendar ingestion runs on 30-minute windows as intended.
- Notes updated with verification steps or remaining gaps.

## Progress

- 2026-01-30: Increased Android sample cadence + throttled derived sync.
- 2026-01-30: Added dev action to re-run last 30-min window.
- 2026-01-30: Added force re-run (clears locks, unlocks events).
- 2026-01-30: Scheduler now runs only on half-hour boundaries.

## Verification

- Not run yet.

## Outcomes

- Pending.

## Follow-ups

- Device validation on Android 16 once cadence changes ship.
