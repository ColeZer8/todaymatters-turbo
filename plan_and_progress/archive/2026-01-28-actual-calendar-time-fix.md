# Actual Calendar Time Alignment

- Status: Completed
- Owner: colezerman
- Started: 2026-01-28
- Completed: 2026-01-28

## Objective

Align the Actual calendar view with real data by fixing time conversions, disabling future clipping, and normalizing adjust-actual save/read time handling.

## Plan

1. Make actual range conversions use local day start, matching daily fetch logic.
2. Stop clipping Actual events after “now” so the column mirrors data.
3. Normalize adjust-actual time round-tripping.

## Done Criteria

- Actual events for range-based sources line up with local day start.
- Actual column no longer hides future events for today.
- Adjust Actual shows and saves the same local times.

## Progress

- 2026-01-28: Updated actual time conversion + visibility behavior.

## Verification

- Not run (not requested).

## Outcomes

- Actual range events now use local-day clipping for startMinutes.
- Actual column no longer hides future events for today.
- Adjust/actual saves use local ISO timestamps for round-trip consistency.

## Follow-ups

- Add regression checks for time zone edge cases.
