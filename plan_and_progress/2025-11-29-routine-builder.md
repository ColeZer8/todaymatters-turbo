# Build your routine step & onboarding UI cleanups

- Status: In Progress
- Owner: Codex
- Started: 2025-11-29
- Completed: ->

## Objective

Add the "Build your routine" onboarding step with reorderable habits, time editing, and themed UI. Stabilize onboarding styling (goals, personas) and avoid gesture-handler dependency issues in Expo Go.

## Scope

- Create routine builder template + page with reorder controls and time editing.
- Keep onboarding progress counts accurate and navigation sequential.
- Maintain theme consistency with existing onboarding cards.
- Avoid native gesture dependencies until environment supports them.

## Done Criteria

- Routine builder page renders with habit cards, up/down reordering, time edit, add/delete.
- Onboarding steps progress correctly through the new page.
- No gesture-handler runtime errors in Expo Go.

## Progress

- 2025-11-29: Added goals step with editable entries and proper text wrapping in the info panel.
- 2025-11-29: Built routine builder UI (add habits, quick add, time edit). Initial drag-and-drop attempt using `react-native-draggable-flatlist` caused RNGestureHandlerModule errors in Expo Go.
- 2025-11-29: Removed gesture dependency, reverted entrypoint, and switched to button-based reordering to keep functionality without native modules.

## Verification

- Pending: Re-run onboarding in Expo Go after cache clear to confirm no RNGestureHandler errors and routine builder reordering works via buttons.

## Outcomes

- Pending

## Follow-ups

- Revisit drag-and-drop once the environment supports gesture handler (native client or updated Expo Go).
- Add tests or stories for routine builder interactions once stabilized.
