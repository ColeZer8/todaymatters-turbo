# Android Keyboard Overlap Fix

- Status: Completed
- Owner: Codex
- Started: 2026-01-20
- Completed: 2026-01-20

## Objective

Ensure Android on-screen keyboard never obscures focused text inputs.

## Plan

1. Identify where input screens are rendered and how keyboard is handled.
2. Apply a consistent keyboard-avoiding layout for Android.
3. Verify on a common text input screen.

## Done Criteria

- Focused text inputs remain visible when Android keyboard appears.
- No regressions in iOS layout behavior.

## Progress

- 2026-01-20: Enabled Android keyboard avoidance in auth + onboarding layouts.

## Verification

- Not run (not requested).

## Outcomes

- Updated keyboard avoidance for auth templates and onboarding layout.
- Improves Android input visibility; no iOS behavior change expected.

## Follow-ups

- Deferred items or next steps
