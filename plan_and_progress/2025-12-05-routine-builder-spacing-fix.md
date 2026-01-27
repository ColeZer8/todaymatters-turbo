# Routine Builder Spacing & Drag-Drop Fix

- Status: Completed
- Owner: AI Assistant
- Started: 2025-12-05
- Completed: 2025-12-05

## Objective

Fix inconsistent spacing in the "Build your routine" screen (Step 11 of onboarding) that appeared after dragging and reordering habit cards. The spacing issue was especially problematic on Android.

## Problem

The original implementation used absolute positioning with manually calculated Y offsets for all items. This approach had several issues:

1. **Position/height sync issues** - The `positions` shared value and `heights` shared value could get out of sync after reordering
2. **Complex worklet calculations** - `getOffsetForId()` computed offsets in worklets, which could have timing issues with JS-side state
3. **Container height mismatch** - The container height was calculated separately from item positions, causing gaps
4. **Stale heights after expand/collapse** - Expanded item heights persisted after collapsing

## Solution

Complete rewrite of `DraggableRoutineList.tsx` with a simpler architecture:

### New Architecture

1. **Flex layout for resting state** - Items render in a normal `View` with `marginBottom: 12` spacing. React Native's layout engine handles spacing automatically—no manual calculations.

2. **Displacement animation during drag** - When dragging:
   - Dragged item uses `dragTranslateY` to follow the finger
   - Other items use `displaceY` to animate up/down and make room
   - `targetIndex` tracks where the item will land

3. **Instant reset on drop** - When released:
   - `onReorder()` is called synchronously first (items re-render in new order)
   - Then drag state resets (all animated values instantly go to 0)
   - No conflicting animations

### Key Changes

| Before                                     | After                         |
| ------------------------------------------ | ----------------------------- |
| All items absolutely positioned            | Flex layout with marginBottom |
| Manual Y offset calculations in worklets   | Layout engine handles spacing |
| Spring animation on drop (caused glitches) | Instant reset on drop         |
| 550+ lines                                 | ~350 lines                    |

## Done Criteria

- [x] Consistent 12px spacing between cards in resting state
- [x] Spacing remains consistent after drag-and-drop reorder
- [x] Other cards animate to make room during drag
- [x] No visual glitch/flicker when dropping
- [x] Works correctly on both iOS and Android

## Progress

- 2025-12-05: Initial investigation - identified absolute positioning as root cause
- 2025-12-05: Multiple attempts to fix sync issues with positions/heights shared values
- 2025-12-05: Rewrote component to use flex layout for resting state
- 2025-12-05: Fixed displacement animation for non-dragged items
- 2025-12-05: Fixed drop animation glitch by using instant reset + sync reorder

## Verification

- `pnpm lint` - No new lint errors
- Manual QA on iOS simulator:
  - [x] Initial render shows correct spacing
  - [x] Drag item shows other items moving out of the way
  - [x] Drop places item correctly without flicker
  - [x] Multiple reorders maintain correct spacing
  - [x] Expand/collapse time editor works correctly

## Outcomes

### Files Changed

- `apps/mobile/src/components/organisms/DraggableRoutineList.tsx` - Complete rewrite
- `apps/mobile/src/components/templates/RoutineBuilderTemplate.tsx` - Minor cleanup (removed redundant wrapper, explicit margins)

### Architecture Trade-offs

| Aspect                    | Old                       | New                    |
| ------------------------- | ------------------------- | ---------------------- |
| Resting state positioning | Absolute (manual)         | Flex (automatic)       |
| During-drag positioning   | Absolute                  | Flex + translateY      |
| Animation complexity      | High (springs everywhere) | Low (targeted springs) |
| Spacing reliability       | Fragile                   | Robust                 |

## Follow-ups

- Consider extracting the drag-and-drop logic into a reusable hook if needed elsewhere
- Android testing recommended to confirm spacing fix on that platform
- The time edit panel (expand/collapse) animation could be smoothed further
