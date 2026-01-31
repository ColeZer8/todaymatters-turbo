# Fix Android Google OAuth Account Picker

- Status: Completed
- Owner: Cole
- Started: 2026-01-30
- Completed: 2026-01-30

## Objective

Ensure Android opens the Google account chooser instead of forcing the add-account flow during Google services OAuth.

## Plan

1. Inspect the Google OAuth launch flow in mobile.
2. Adjust OAuth parameters to prefer account selection on Android.
3. Verify flow manually on device.

## Done Criteria

- Android OAuth launch shows account chooser for existing Google accounts.
- No regression to OAuth callback handling.

## Progress

- 2026-01-30: Added Android-specific prompt adjustment to include `select_account`.

## Verification

- Not run (manual Android OAuth flow recommended).

## Outcomes

- Updated OAuth URL handling to append `prompt=select_account` on Android before opening the session.

## Follow-ups

- Run the Android OAuth flow and confirm account chooser behavior.
