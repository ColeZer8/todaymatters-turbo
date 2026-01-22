# Android Permissions Screen-Time Flow

- Status: Completed
- Owner: Codex
- Started: 2026-01-22
- Completed: 2026-01-22

## Objective

Fix the Android permissions flow to remove Health, keep Location unchanged, and route users to the Android App Data screen for screen time access.

## Plan

1. Inspect the permissions flow and Android-specific routing.
2. Remove the Health option and its navigation entry points.
3. Route screen-time permission to the Android App Data screen.
4. Verify flow logic and update any copy/ordering as needed.

## Done Criteria

- Android permissions page no longer offers Health.
- Health permission screen is unreachable in Android flow.
- Screen time permission opens Android App Data settings screen.
- Location permission behavior remains unchanged.

## Progress

- 2026-01-22: Removed Health permission from onboarding, adjusted Android Screen Time flow to open App data settings, and normalized persisted permissions.

## Verification

- Not run (not requested).

## Outcomes

- What changed (links to PRs/commits)
- Impact/tradeoffs

## Follow-ups

- Deferred items or next steps
