# Background Location Debug

- Status: In Progress
- Owner: Cole
- Started: 2026-01-31
- Completed: -

## Objective

Provide a debug screen that shows background location collection status,
including the native queue size, to verify collection while app is closed.

## Plan

1. Expose native queue peek/count from the WorkManager module.
2. Add an Android-only debug screen under `dev/`.
3. Show tracking status, queue sizes, and recent native samples.

## Done Criteria

- Native module returns pending count and sample peek.
- Debug screen displays tracking state + queue counts.
- Screen updates on refresh and interval without crashing.

## Progress

- 2026-01-31: Added native peek/count APIs and new debug screen.

## Verification

- Not run (manual QA needed in app).

## Outcomes

- Added background queue inspection to aid Android verification.

## Follow-ups

- Optional: surface native queue size in main dev menu.
