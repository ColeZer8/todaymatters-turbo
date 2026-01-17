# Actual calendar hide future

- Status: In Progress
- Owner: cole
- Started: 2026-01-16
- Completed: -

## Objective

Hide "actual" timeline items that occur after the current time.

## Plan

1. Locate actual calendar rendering logic.
2. Update rendering to omit future actual entries.
3. Verify UI behavior.

## Done Criteria

- Actual column shows no items under the current-time red line.
- No regressions in planned column rendering.

## Progress

- 2026-01-16: Clamped actual event rendering to current time and enabled multi-line event text when space allows.

## Verification

- Not run yet.

## Outcomes

- Updated actual column rendering to hide future portions of events.
- Allowed event titles/descriptions to use multiple lines when block height allows.

## Follow-ups

- None.
