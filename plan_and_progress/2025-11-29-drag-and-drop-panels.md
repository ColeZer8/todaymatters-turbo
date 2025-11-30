# Drag-and-drop panel research

- Status: Completed
- Owner: Assistant
- Started: 2025-11-29
- Completed: 2025-11-29

## Objective

Research how to add drag-and-drop reordering for panel cards in the Expo Router app, confirm Expo 54 + React Native 0.81 + Reanimated 4 compatibility, and capture best practices for implementing the feature within the project conventions.

## Plan

1. Review current dependencies, tooling, and layout wrappers relevant to gestures/Reanimated.
2. Gather Expo-aligned guidance for drag-and-drop reordering and component structure.
3. Produce a docs entry with recommended approach, version pins, and implementation steps.

## Done Criteria

- Documentation exists in /docs with a clear approach for drag-and-drop reordering.
- Version compatibility is called out for Expo 54 / RN 0.81 / Reanimated 4.
- Notes cover atomic design placement, styling guidance, and verification steps.

## Progress

- 2025-11-29: Reviewed Expo 54 stack (RN 0.81.4, Reanimated 4.1.0), noted missing gesture-handler dependency, and documented recommended drag-and-drop approach in docs/drag-and-drop-panels.md.
- 2025-11-29: Added build-routine specific guide with UX goals and implementation checklist in docs/build-routine-drag.md.
- 2025-11-29: Implemented drag-and-drop on the Build Routine page using a new DraggableRoutineList organism (Gesture Handler + Reanimated), wrapped app root in GestureHandlerRootView, and updated docs with implementation status.
- 2025-11-29: Iteration—removed visible drag handle, relying on long-press anywhere on the card; removed outer list panel per UX feedback.

## Verification

- Not run (research-only task).

## Outcomes

- Added research summary and implementation playbook in docs/drag-and-drop-panels.md covering versions, stack choice, layout wrapper needs, and best practices.

## Follow-ups

- Implement the documented approach on the target page and wire persistence once priorities are set.
