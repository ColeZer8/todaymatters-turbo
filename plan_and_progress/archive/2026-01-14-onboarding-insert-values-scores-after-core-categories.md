# Insert “Values Scores” ranking after Time Categories

- Status: Completed
- Owner: Cole
- Started: 2026-01-14
- Completed: 2026-01-14

## Objective

Bring back the ranking screen (`values-scores`) and place it right after the “Time Categories” screen (`core-categories`) in the setup flow.

## Plan

1. Rewire navigation: `core-categories` → `values-scores` → `goals`.
2. Update back navigation on Goals to return to `values-scores`.
3. Update setup step map to include `valuesScores`.

## Done Criteria

- After `core-categories`, user lands on `values-scores`.
- From `values-scores`, Continue goes to `goals` and Back goes to `core-categories`.
- Setup step indicator reflects the inserted step.

## Progress

- 2026-01-14: Inserted `values-scores` right after `core-categories`, rewired back/continue targets, and updated setup step map.

## Verification

- `cursor` lints: no errors on touched files (Cursor diagnostics).

## Outcomes

- `core-categories` → `values-scores` → `goals` is now the setup flow.
- `values-scores` Back goes to `core-categories`; Goals Back goes to `values-scores`.

