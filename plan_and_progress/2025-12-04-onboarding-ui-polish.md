# Onboarding UI Polish

- Status: Completed
- Owner: Agent
- Started: 2025-12-04
- Completed: 2025-12-04

## Objective

Address user feedback on the onboarding flow UI/UX issues reported by the boss. Multiple screens needed fixes ranging from missing functionality to keyboard handling problems.

## Plan

1. Fix Permissions page - add expandable individual permissions UI
2. Fix Joy page - show selected items at top, auto-select custom items
3. Fix Goals page - keyboard covering input fields
4. Fix Routine Builder - allow keyboard input for duration (not just +/- buttons)

## Done Criteria

- [x] Permissions page shows individual toggles when "View individual permissions" is tapped
- [x] Joy page shows "Your selections" section at top with selected items
- [x] Custom items added via search are auto-selected and appear at top
- [x] Keyboard no longer covers input fields on Goals page
- [x] Duration in Routine Builder can be edited via keyboard tap
- [x] Panel doesn't collapse when tapping the duration input

## Progress

- 2025-12-04: Implemented all four issues in sequence
  - Issue #1: Built expandable permissions with 8 individual toggles (Calendar, Notifications, Email, Health, Location, Contacts, Browsing, App Usage)
  - Issue #4: Added "Your selections" section to TagSelectionTemplate with removable pills
  - Issue #10: Added KeyboardAvoidingView to SetupStepLayout for all onboarding screens
  - Issue #11: Made duration editable via TextInput, fixed panel collapse issue

## Verification

- `pnpm lint` - No new lint errors introduced
- Manual QA on iOS simulator:
  - Permissions: Individual toggles expand/collapse correctly, all toggles functional
  - Joy: Selections appear at top, custom items auto-select
  - Goals: Keyboard properly adjusts view, inputs remain visible
  - Routine Builder: Duration can be typed directly, panel stays open during editing

## Outcomes

### Files Changed

**Permissions Page:**
- `apps/mobile/src/app/permissions.tsx` - Added state management for individual permissions
- `apps/mobile/src/components/templates/PermissionsTemplate.tsx` - Complete rewrite with NativeWind, individual permission rows with dividers
- `apps/mobile/src/components/templates/index.ts` - Export new types

**Joy/Tag Selection:**
- `apps/mobile/src/components/templates/TagSelectionTemplate.tsx` - Added "Your selections" section at top with removable pills

**Keyboard Handling (affects all onboarding screens):**
- `apps/mobile/src/components/organisms/SetupStepLayout.tsx` - Added KeyboardAvoidingView wrapper and `automaticallyAdjustKeyboardInsets`

**Routine Builder:**
- `apps/mobile/src/components/organisms/DraggableRoutineList.tsx` - Made duration a TextInput, added tap gesture handling, disabled card tap when expanded

### Key Implementation Details

1. **Permissions Toggle Logic**: "Allow all" is computed from individual permissions state - toggling all on/off updates all 8 permissions, and if any individual permission is off, "Allow all" shows as off.

2. **Duration Input UX**: When panel is expanded, the card header no longer responds to taps (prevents accidental closure). User must press "Done" to close. This is intentional to allow editing without interference.

3. **Keyboard Handling**: Uses `KeyboardAvoidingView` with `behavior="padding"` on iOS plus `automaticallyAdjustKeyboardInsets` on ScrollView for best results.

## Follow-ups

- None - all requested changes implemented

