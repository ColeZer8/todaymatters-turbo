# Google OAuth Account Chooser (Dev)

- Status: Completed
- Owner: Cole
- Started: 2026-01-30
- Completed: 2026-01-30

## Objective

Make it possible to show the Google account chooser on Android during OAuth
when testing on simulators or with non-domain accounts.

## Plan

1. Add a dev-only override to drop domain restriction (`hd`) on OAuth URLs.
2. Verify the final OAuth URL params in dev logs.
3. Test on Android (sim or device).

## Done Criteria

- Dev override removes `hd` from the OAuth URL when enabled.
- Account chooser is reachable when Google has accounts available.

## Progress

- 2026-01-30: Added dev flag to strip `hd` for Google OAuth URLs.

## Verification

- Not run (manual Android OAuth flow recommended).

## Outcomes

- Added `EXPO_PUBLIC_GOOGLE_OAUTH_ALLOW_ANY_ACCOUNT` to allow account chooser testing without domain restriction.

## Follow-ups

- Run Android OAuth flow with dev flag enabled.
