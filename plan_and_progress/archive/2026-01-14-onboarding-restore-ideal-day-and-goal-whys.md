# Restore Ideal Day + Goals Deep Dive in onboarding flow

- Status: Completed
- Owner: Cole
- Started: 2026-01-14
- Completed: 2026-01-14

## Objective

Bring back the “Goals deep dive” screen after Goals and restore the Ideal Day setup screen into the onboarding flow, while keeping other non-meeting screens out of the main path. Also revert the explainer video page behavior back to the previous version.

## Plan

1. Rewire navigation: Goals → Goal Whys → Ideal Day → (resume meeting flow).
2. Update meeting-flow step constants so progress indicators are correct.
3. Revert explainer video page step/progress behavior to match previous UI.

## Done Criteria

- After Goals, the app navigates to Goal Whys.
- Goal Whys navigates to Ideal Day.
- Ideal Day continues to the next meeting screen (not the full onboarding chain).
- Explainer video screen looks/behaves like it did pre-change.

## Progress

- 2026-01-14: Restored flow to include Goals → Goal Whys → Ideal Day; rewired Ideal Day to continue to Daily Rhythm (keeps non-meeting screens out of the path); reverted explainer-video step/progress behavior.

## Verification

- `cursor` lints: no errors on touched files (Cursor diagnostics).

## Outcomes

- Meeting flow now includes:
  - `explainer-video` → `permissions` → `core-values` → `core-categories` → `sub-categories` → `goals` → `goal-whys` → `ideal-day` → `daily-rhythm` → `my-church` → `home`
- Explainer video screen uses the original onboarding step/total values again.

## Follow-ups

- Confirm final meeting flow ordering with client (where Daily Rhythm + Church should sit relative to Ideal Day).
