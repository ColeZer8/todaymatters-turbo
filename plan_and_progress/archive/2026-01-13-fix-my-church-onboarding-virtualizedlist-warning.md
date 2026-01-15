# Fix My Church onboarding VirtualizedList warning

- Status: Completed
- Owner: colezerman
- Started: 2026-01-13
- Completed: 2026-01-13

## Objective

Eliminate the React Native warning: "VirtualizedLists should never be nested inside plain ScrollViews…" on the "Pick your church" onboarding page.

## Plan

1. Identify where a VirtualizedList (`FlatList`) is nested inside a `ScrollView`.
2. Refactor dropdown rendering to avoid nested VirtualizedLists.
3. Verify via TypeScript + lint and manual run.

## Done Criteria

- The "Pick your church" screen no longer logs the VirtualizedLists nesting warning.
- TypeScript and lint pass for the mobile app.

## Progress

- 2026-01-13: Located nested `FlatList` dropdown inside `SetupStepLayout`'s `ScrollView`. Refactored dropdown rendering to avoid VirtualizedList nesting.

## Verification

- `pnpm --filter mobile check-types` (pass)
- `pnpm --filter mobile lint` (pass; existing warnings in config/mock files)
- Manual QA: open "Pick your church" screen, type in the church field, confirm no VirtualizedLists warning in console.

## Outcomes

- Updated dropdown rendering in `MyChurchTemplate` to remove nested VirtualizedList usage.

## Follow-ups

- Archived.

