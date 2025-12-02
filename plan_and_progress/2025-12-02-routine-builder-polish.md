# Routine Builder Drag & Time Panel Polish

- Status: Completed
- Owner: Agent
- Started: 2025-12-02
- Completed: 2025-12-02

## Objective

Polish the routine builder's drag-and-drop reordering animation and time editing panel UX. Fix issues where:
1. Dragged items didn't follow the user's finger
2. Items could only be dropped at top/bottom, not in the middle
3. Time panel closed when trying to adjust time
4. Time increments were too large (5min)
5. Panel expansion animation was too bouncy

## Plan

1. Fix drag animation to follow finger exactly
2. Fix drop position calculation to allow middle placement
3. Move gesture callback from `onBegin` to `onStart` 
4. Add hold-to-repeat for time buttons
5. Connect time panel visually to category card
6. Tune spring animation for smoother expand/collapse

## Done Criteria

- [x] Dragged item follows finger 1:1
- [x] Items can be dropped between any two items
- [x] Time panel stays open when adjusting time
- [x] +/- buttons increment by 1 minute
- [x] Hold +/- to continuously change time
- [x] Time panel visually connects to category card
- [x] Smooth, non-bouncy panel expansion

## Progress

- 2025-12-02: Fixed drag animation - changed to `absoluteY = startY + translationY` approach where `startY` is captured once and never changes during drag. Item now follows finger exactly.

- 2025-12-02: Added `findIndexForCenterExcluding()` function that excludes the dragged item when calculating drop positions. This fixed the issue where items could only drop at top/bottom.

- 2025-12-02: Changed gesture handler from `onBegin` to `onStart`. `onBegin` fires immediately on touch, but `onStart` fires after the 150ms long-press delay. This fixed the time panel closing when tapping +/- buttons.

- 2025-12-02: Added `useRepeatPress` hook for hold-to-repeat functionality:
  - Fires immediately on press
  - After 400ms delay, repeats every 80ms
  - Proper cleanup on release

- 2025-12-02: Changed time increments from 5 minutes to 1 minute.

- 2025-12-02: Connected time panel design:
  - `RoutineItemCard` accepts `expanded` prop
  - When expanded: `rounded-t-2xl rounded-b-none border-b-0`
  - Time panel: `rounded-b-2xl border-t-0` with `marginTop: -1`
  - Creates seamless connected appearance

- 2025-12-02: Tuned `LAYOUT_SPRING` config to reduce bounce:
  - Damping: 22 → 28
  - Stiffness: 180 → 140
  - Mass: added 0.9

## Verification

- `pnpm lint` - No errors
- `pnpm check-types` - No errors
- Manual QA on iOS simulator:
  - Drag items - follows finger smoothly
  - Drop in middle - works correctly
  - Tap category - panel expands/collapses
  - Tap +/- - adjusts time, panel stays open
  - Hold +/- - continuously adjusts
  - Panel animation - smooth, minimal bounce

## Outcomes

Files modified:
- `apps/mobile/src/components/organisms/DraggableRoutineList.tsx`
  - Rewrote drag logic with `absoluteY`/`startY` approach
  - Added `findIndexForCenterExcluding()` worklet
  - Changed `onBegin` → `onStart` for gesture
  - Added `useRepeatPress` hook
  - Extracted `TimeEditPanel` component
  - Tuned spring configs

- `apps/mobile/src/components/molecules/RoutineItemCard.tsx`
  - Added `expanded` prop for connected design
  - Conditional border radius classes

## Follow-ups

- Consider adding haptic feedback on drag start and item swap
- Could add visual indicator (slight highlight) when item is being dragged over a drop zone
- Time panel could animate its height when expanding (currently just appears)

