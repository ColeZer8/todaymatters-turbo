# Settings Personalization Screens

## Objective
Add editable versions of onboarding screens to the settings/profile area, allowing users to modify their preferences after initial setup.

## Status: Completed ✅
**Completed:** 2025-12-11

---

## Scope

### Screens Added to Settings
1. **Daily Rhythm** (`/settings/daily-rhythm`) - Edit wake/sleep times
2. **Coach Persona** (`/settings/coach-persona`) - Change AI coach style
3. **Morning Routine** (`/settings/build-routine`) - Edit morning routine habits
4. **Ideal Day** (`/settings/ideal-day`) - Adjust time allocation for activities

### Files Created
- `apps/mobile/src/app/settings/_layout.tsx` - Settings folder layout (hides Expo header)
- `apps/mobile/src/app/settings/daily-rhythm.tsx`
- `apps/mobile/src/app/settings/coach-persona.tsx`
- `apps/mobile/src/app/settings/build-routine.tsx`
- `apps/mobile/src/app/settings/ideal-day.tsx`

### Files Modified
- `apps/mobile/src/app/_layout.tsx` - Added settings group with `headerShown: false`
- `apps/mobile/src/app/profile.tsx` - Added "Personalization" section with navigation buttons
- `apps/mobile/src/components/templates/ProfileTemplate.tsx` - Added `personalizationItems` prop
- `apps/mobile/src/components/organisms/SetupStepLayout.tsx` - Added `mode` prop for settings/onboarding
- `apps/mobile/src/components/templates/DailyRhythmTemplate.tsx` - Added `mode` prop
- `apps/mobile/src/components/templates/CoachPersonaTemplate.tsx` - Added `mode` prop
- `apps/mobile/src/components/templates/RoutineBuilderTemplate.tsx` - Added `mode` prop
- `apps/mobile/src/components/templates/IdealDayTemplate.tsx` - Added `mode` prop

---

## Implementation Details

### Template Mode System
Each template now supports a `mode` prop:
- `'onboarding'` (default) - Shows progress bar, step indicators, and continue button
- `'settings'` - Shows clean back button header, hides progress/continue elements

### Settings Header Styling
- Clean "← Back" button with brand-primary color
- 18px arrow icon with 2.5 stroke width
- Left-aligned layout
- Proper touch target with hitSlop

### Data Persistence
Settings screens use the same Zustand stores as onboarding:
- `useOnboardingStore` - Wake/sleep times, coach persona
- `useRoutineBuilderStore` - Morning routine items
- `useIdealDayStore` - Day type allocations

Changes made in settings persist and reflect across the app.

---

## Done Criteria
- [x] Daily Rhythm screen accessible from profile settings
- [x] Coach Persona screen accessible from profile settings
- [x] Build Routine screen accessible from profile settings
- [x] Ideal Day screen accessible from profile settings
- [x] No duplicate headers showing
- [x] Back button navigates correctly to profile
- [x] Onboarding screens remain untouched
- [x] Data changes persist via existing stores

---

## Verification
```bash
# Restart bundler after layout changes
npx expo start -c

# Test navigation
1. Go to Profile screen
2. Scroll to "Personalization" section
3. Tap each setting option
4. Verify single header, proper back navigation
5. Make changes and verify they persist
```

---

## Notes
- Onboarding screens were NOT modified - they continue to work exactly as before
- The `mode` prop is optional and defaults to `'onboarding'` for backward compatibility
- Settings screens don't show continue/submit buttons - changes auto-save via stores



