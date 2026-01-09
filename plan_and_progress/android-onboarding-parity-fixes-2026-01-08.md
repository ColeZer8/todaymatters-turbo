# Android onboarding parity fixes (Continue button / keyboard / routine drag)

- Status: In Progress
- Owner: Cursor Agent
- Started: 2026-01-08
- Completed: -

## Objective

Bring Android onboarding UX in line with iOS for:
- Primary CTA (Continue/Looks Good) rendering
- Keyboard avoidance (inputs not covered by keyboard)
- Routine Builder drag + animations

## Plan

1. Fix any Android-only layout/gesture regressions first so screens render and respond.
2. Adjust Android keyboard behavior without changing iOS behavior.
3. Make Routine Builder drag gestures reliable on Android by keeping gesture logic UI-thread safe.
4. Re-check visuals (CTA shadow/elevation) on Android only.

## Done Criteria

- CTA looks like iOS on Android (no weird stacked/boxed shadow).
- On Android, focusing a TextInput never leaves the field hidden behind the keyboard; user can scroll to see it.
- On Android, Routine Builder cards can be reordered with smooth animations, matching iOS behavior.
- No behavior changes on iOS.

## Progress

- 2026-01-08: Investigation started; identified Reanimated warning about ref mutation inside worklets during drag.

## Verification

- Manual QA on Android emulator: onboarding inputs + Build Routine drag.

## Outcomes

- Pending.

## Follow-ups

- If needed, add a dedicated drag handle to reduce ScrollView gesture competition (Android only).


