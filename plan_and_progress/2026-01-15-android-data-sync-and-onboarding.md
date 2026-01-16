# Android data sync and onboarding restore

- Status: In Progress
- Owner: Cole
- Started: 2026-01-15
- Completed: -

## Objective

Restore Android data pulls (location, health, screen time) and bring back the onboarding
screen for Google Calendar + Mail with full functionality on iOS and Android.

## Plan

1. Locate prior working implementation and Android permissions/config.
2. Restore onboarding screen and related flows.
3. Apply fixes, run/verify on Android, note QA steps.

## Done Criteria

- Android pulls location, health, and screen time data again.
- Onboarding includes Google Calendar + Mail sync screen on iOS + Android.
- Manual QA confirms flows complete without runtime errors.

## Progress

- 2026-01-15: Restored Google services step in setup flow, added Android health/usage permission prompts, hardened Android background location permission checks, added Health Connect package visibility for Android 11+, added Android screen-time + location dev dashboards, and added hourly app breakdown + local-only banners in the Android screen time UI.

## Verification

- Commands run (lint/typecheck/build) and results
- Manual QA steps as needed

## Outcomes

- What changed (links to PRs/commits)
- Impact/tradeoffs

## Follow-ups

- Deferred items or next steps
