# Android Notification Permission + Diagnostics

- Status: In Progress
- Owner: assistant
- Started: 2026-01-30
- Completed: -

## Objective

Ensure Android 13+ notification permission is requested for the foreground
service location notification, with a settings fallback and diagnostics visibility.

## Plan

1. Add Android POST_NOTIFICATIONS request + status helpers.
2. Integrate permission request into onboarding notifications toggle.
3. Expose notification status in Android location diagnostics.

## Done Criteria

- Android notifications permission is requested during onboarding when enabled.
- Denied state prompts a Settings fallback.
- Diagnostics show notification permission status.

## Progress

- 2026-01-30: Added notification settings deep-link + Android channel init.

## Verification

- Not run yet.

## Outcomes

- Pending.

## Follow-ups

- Run on device to verify Android 13+ notification permission flow.
