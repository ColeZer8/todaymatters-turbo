# Review Time Notification Badge

- Status: Completed
- Owner: Cole
- Started: 2025-12-04
- Completed: 2025-12-04

## Objective

Add a notification indicator on the home page that appears when there are unassigned time blocks in the Review Time screen. This helps remind users to categorize their time and provides a quick tap-to-navigate shortcut.

## Plan

1. Create a shared Zustand store to track time blocks and their assignments
2. Update ReviewTimeTemplate to use the shared store instead of local state
3. Add a notification badge to the Greeting component on the home page
4. Badge disappears when all items are assigned

## Done Criteria

- [x] Notification badge appears on home page when unassigned items exist
- [x] Badge shows count of unassigned time blocks
- [x] Tapping badge navigates to Review Time screen
- [x] Badge disappears when all items are assigned
- [x] Design uses brand blue color, is minimal and on-theme

## Progress

- 2025-12-04: Initial implementation with amber badge + clock icon
- 2025-12-04: Simplified to clean blue circle with just the number per feedback

## Verification

- TypeScript: `npx tsc --noEmit` passes for all modified files
- Lint: No new linter errors introduced
- Manual QA: Badge appears with correct count, navigates on tap, disappears when items assigned

## Outcomes

### Files Created
- `apps/mobile/src/stores/review-time-store.ts` - Zustand store for time block assignments

### Files Modified
- `apps/mobile/src/stores/index.ts` - Export new store
- `apps/mobile/src/components/molecules/Greeting.tsx` - Added badge with pulse animation
- `apps/mobile/src/components/organisms/DailyBrief.tsx` - Pass unassigned count to Greeting
- `apps/mobile/src/components/templates/ReviewTimeTemplate.tsx` - Use shared store
- `apps/mobile/src/components/templates/HomeTemplate.tsx` - Convert to NativeWind styling

### Design
- Minimal 28×28px circle badge
- Brand blue (#2563EB) at 15% opacity background
- Solid brand blue text
- Subtle pulse animation
- Positioned at right edge of "Good morning," line

## Follow-ups

- Connect to real API data instead of mock time blocks
- Persist assignments to Supabase
- Add time-based logic (show yesterday's unassigned blocks in the morning)








