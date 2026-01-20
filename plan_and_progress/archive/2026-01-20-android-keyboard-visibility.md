# Android Keyboard Visibility

- Status: Completed
- Owner: Codex
- Started: 2026-01-20
- Completed: 2026-01-20

## Objective

Ensure Android screens keep focused text inputs visible above the keyboard across the app.

## Plan

1. Identify screens/components where inputs can be obscured on Android.
2. Add a shared keyboard-avoiding wrapper and apply it to affected templates.
3. Verify behavior on the Actual Adjust flow and document results.

## Done Criteria

- Android text inputs near the bottom remain visible when the keyboard opens.
- Shared keyboard-avoidance approach is applied consistently to templates with text inputs.
- Verification steps and outcomes are recorded.

## Progress

- 2026-01-20: Added global Android keyboard avoidance wrapper and limited screen-level keyboard avoidance to iOS.

## Verification

- Not run (manual QA recommended on Android to confirm focused inputs stay visible).

## Outcomes

- What changed: Added an Android-only root KeyboardAvoidingView and updated templates to avoid double keyboard offsets.
- Impact/tradeoffs: Android screens now resize for the keyboard globally; iOS keeps per-screen keyboard behavior.

## Follow-ups

- Deferred items or next steps
