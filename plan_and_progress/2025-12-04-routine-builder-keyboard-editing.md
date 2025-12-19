# Routine Builder Keyboard Time Editing

- Status: Completed
- Owner: Cole
- Started: 2025-12-04
- Completed: 2025-12-04

## Objective

Allow users to edit routine item duration times using their keyboard in addition to the existing +/- buttons. The goal was to make this surgical - minimal changes while preserving all existing functionality.

## Plan

1. Replace static `Text` element with editable `TextInput` for the minutes display
2. Handle gesture conflicts with the drag-and-drop system
3. Implement auto-save on valid input
4. Add subtle visual indication that the time is editable
5. Fix panel switching behavior for smooth transitions

## Done Criteria

- [x] User can tap on time display and edit with keyboard
- [x] +/- buttons continue to work as before
- [x] Drag and drop continues to work (disabled when panel expanded)
- [x] Auto-saves on valid input (no need to click Done or blur)
- [x] Switching between panels is smooth
- [x] Time display looks subtly clickable/editable

## Progress

- 2025-12-04: Initial implementation with TextInput caused panel collapse due to gesture conflicts
- 2025-12-04: Added `.enabled(!expanded)` to Pan gesture to disable dragging when panel is open
- 2025-12-04: Fixed save functionality using refs to track latest input value
- 2025-12-04: Implemented smooth panel switching with 50ms delay between close/open
- 2025-12-04: Changed to auto-save on every valid keystroke
- 2025-12-04: Added subtle blue background styling to indicate editability

## Verification

- Lint check: No errors
- Manual QA:
  - Tapping time display allows keyboard editing
  - Auto-saves valid numbers (≥1) immediately
  - +/- buttons still work and update display
  - Panel switching is smooth (closes first, then opens new)
  - Drag and drop works when panel is collapsed

## Outcomes

### Files Changed

- `apps/mobile/src/components/organisms/DraggableRoutineList.tsx`
  - Added `TextInput` import
  - Modified `TimeEditPanel` to use controlled input with auto-save
  - Added `.enabled(!expanded)` to Pan gesture
  - Added subtle styling (`bg-[#F0F6FF]`, `text-brand-primary`, rounded corners)

- `apps/mobile/src/components/templates/RoutineBuilderTemplate.tsx`
  - Added `useCallback` import
  - Created `handleToggleExpand` for smooth panel switching (close → delay → open)

### Key Implementation Details

1. **Gesture Conflict Resolution**: Disabled the Pan gesture when `expanded` is true, allowing TextInput to receive touches normally

2. **Auto-Save**: `handleChangeText` saves immediately on every valid input:
   ```typescript
   const handleChangeText = useCallback((text: string) => {
     setLocalMinutes(text);
     const parsed = parseInt(text, 10);
     if (!isNaN(parsed) && parsed >= 1) {
       onChangeMinutes(item.id, parsed);
     }
   }, [item.id, onChangeMinutes]);
   ```

3. **Smooth Panel Switching**: When switching panels, close current first, wait 50ms, then open new:
   ```typescript
   if (prev !== null) {
     setTimeout(() => setExpandedId(id), 50);
     return null;
   }
   ```

4. **Visual Indicator**: Light blue background with blue text matching the +/- button style

## Follow-ups

- None identified





