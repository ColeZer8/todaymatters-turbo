# Onboarding Persistence & Ideal Day Improvements

- Status: Completed
- Owner: AI Assistant
- Started: 2024-12-05
- Completed: 2024-12-05

## Objective

Improve the onboarding flow by:
1. Adding navigation (back button) to the Ideal Day page
2. Splitting weekend options into separate Saturday/Sunday selections
3. Persisting all onboarding data locally so users can navigate back and see their selections
4. Adding a convenient top continue button on tag selection pages

## Plan

1. Add back button to Ideal Day page using existing SetupStepLayout pattern
2. Update day type options from `weekdays | weekends | custom` to `weekdays | saturday | sunday | custom`
3. Create centralized onboarding store with AsyncStorage persistence
4. Update all 12 onboarding pages to use persisted stores instead of local useState
5. Fix slider stale closure bug preventing hour changes from registering
6. Add top continue button to Joy/Drains tag selection pages

## Done Criteria

- [x] Back button on Ideal Day navigates to previous screen
- [x] Saturday and Sunday are separate options in day type selector
- [x] All onboarding selections persist when navigating back
- [x] Slider changes register and persist correctly
- [x] Top continue button appears on Joy/Drains pages when selections exist

## Progress

- 2024-12-05: Added back button to IdealDayTemplate, passed onBack prop from page
- 2024-12-05: Updated DayType from weekends to saturday/sunday in store and template
- 2024-12-05: Created onboarding-store.ts with AsyncStorage persistence for steps 1-10
- 2024-12-05: Added persistence to routine-builder-store.ts (step 11)
- 2024-12-05: Fixed ideal-day-store.ts icon serialization for persistence (step 12)
- 2024-12-05: Fixed SliderBar stale closure bug using ref pattern
- 2024-12-05: Updated all 12 page files to use stores with hydration loading states
- 2024-12-05: Added grey continue button to TagSelectionTemplate header

## Verification

- Linter checks passed on all modified files
- Manual QA: Selections persist when navigating back through onboarding flow
- Manual QA: Slider changes register and save correctly
- Manual QA: Back button navigates correctly on all pages

## Outcomes

### Files Created
- `apps/mobile/src/stores/onboarding-store.ts` - Centralized store for onboarding data

### Files Modified

**Stores:**
- `apps/mobile/src/stores/ideal-day-store.ts` - Added persistence, split weekends to saturday/sunday
- `apps/mobile/src/stores/routine-builder-store.ts` - Added AsyncStorage persistence
- `apps/mobile/src/stores/index.ts` - Exported new stores

**Pages (all updated to use stores with hydration):**
- `apps/mobile/src/app/permissions.tsx`
- `apps/mobile/src/app/setup-questions.tsx`
- `apps/mobile/src/app/daily-rhythm.tsx`
- `apps/mobile/src/app/joy.tsx`
- `apps/mobile/src/app/drains.tsx`
- `apps/mobile/src/app/your-why.tsx`
- `apps/mobile/src/app/focus-style.tsx`
- `apps/mobile/src/app/coach-persona.tsx`
- `apps/mobile/src/app/morning-mindset.tsx`
- `apps/mobile/src/app/goals.tsx`
- `apps/mobile/src/app/build-routine.tsx`
- `apps/mobile/src/app/ideal-day.tsx`

**Templates:**
- `apps/mobile/src/components/templates/IdealDayTemplate.tsx` - Added onBack prop, updated day types, fixed slider
- `apps/mobile/src/components/templates/TagSelectionTemplate.tsx` - Added top continue button

### Key Technical Details

1. **Icon Serialization**: Icons (React components) cannot be stored in AsyncStorage. Solution: Store `iconName` string, use lookup map to restore icons on hydration via custom `merge` function.

2. **Stale Closure Fix**: SliderBar's PanResponder was capturing old onChange callback. Solution: Use `useRef` to always reference current callback.

3. **Hydration Loading**: All pages show ActivityIndicator until store hydrates from AsyncStorage, preventing flash of default values.

4. **Store Structure**: Onboarding store holds all data for steps 1-10. Routine builder and ideal day have separate stores due to complex data structures.

## Follow-ups

- Consider adding a "Reset Onboarding" option in settings
- May want to sync onboarding data to backend once user completes flow
- Debug console.logs can be removed from stores once confirmed stable




