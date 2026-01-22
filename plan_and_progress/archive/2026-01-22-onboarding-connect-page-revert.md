# Onboarding Connect Page Revert

- Status: Completed
- Owner: Codex
- Started: 2026-01-22
- Completed: 2026-01-22

## Objective

Restore the onboarding connect services page UI to the state from 2026-01-21 after today’s regressions.

## Plan

1. Locate the screen component and identify its prior state in git history.
2. Restore only that file to the 2026-01-21 version and keep unrelated changes intact.

## Done Criteria

- The connect services screen matches the 2026-01-21 UI state.
- Only the target page file is reverted; no other pages touched.

## Progress

- 2026-01-22: Restored connect services screen to 2026-01-21 state by reverting the page file.

## Verification

- Commands run: none.
- Manual QA: not run (not requested).

## Outcomes

- What changed: restored `apps/mobile/src/app/connect-google-services.tsx` to commit `a7bbaa9`.
- Impact: page UI reverts to prior behavior; no other files touched.

## Follow-ups

- Deferred items or next steps
