# Onboarding - Connect Google Services

- Status: Completed
- Owner: Codex
- Started: 2026-01-06
- Completed: 2026-01-06

## Objective

Add an onboarding screen that lets users choose which Google services (Calendar, Gmail) to connect, then initiates the separate Google Services OAuth flow (not Supabase Auth Google sign-in).

## Plan

1. Implement an onboarding-themed service picker UI (multi-select + permission disclosure).
2. Start Google Services OAuth with the selected services and handle deep-link callbacks.
3. Wire the new screen into the onboarding step flow and verify lint/typecheck.

## Done Criteria

- New onboarding screen matches existing onboarding styling and navigation.
- User can select services and initiate OAuth via `startGoogleServicesOAuth`.
- Success/error deep-link callbacks are reflected in UI, and onboarding can proceed.
- `pnpm --filter mobile lint` and `pnpm --filter mobile check-types` pass (no new errors).

## Progress

- 2026-01-06: Implemented onboarding “Connect Google Services” screen and verified wiring.

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅ (existing warnings in repo; no new errors)

## Outcomes

- Added an onboarding screen for selecting Google services (Calendar/Gmail) and starting Google Services OAuth.
- Inserted the new step between `permissions` and `setup-questions`, updated step counts, and registered the route in the root stack.

## Follow-ups

- Decide how to determine “already connected services” from backend/supabase, if needed for disabling selections.


