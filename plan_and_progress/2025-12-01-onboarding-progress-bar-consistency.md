# Onboarding Progress Bar Consistency

- Status: Completed
- Owner: AI Agent
- Started: 2025-12-01
- Completed: 2025-12-01

## Objective

Unify the progress bar styling and page numbering across all onboarding pages. The first 2-3 pages had inconsistent progress bar styling (bigger bars, different spacing) compared to pages 3+. Additionally, the page numbering was split between two systems (permissions showed "1 of 5" while setup-questions showed "1 of 11").

## Plan

1. Update onboarding constants to include permissions as step 1 (total = 12)
2. Update PermissionsTemplate to match SetupStepLayout progress bar style
3. Update SetupQuestionsTemplate to match SetupStepLayout progress bar style
4. Add back button support to all onboarding pages
5. Make back buttons functional with explicit navigation

## Done Criteria

- [x] All onboarding pages show consistent step numbering (1-12)
- [x] All progress bars have identical styling (6px height, #E4E8F0 background)
- [x] All pages have a back button in the header
- [x] Back buttons navigate to the correct previous page
- [x] No linting or TypeScript errors

## Progress

- 2025-12-01: Updated `constants/onboarding.ts` to include permissions as step 1, total steps = 12
- 2025-12-01: Updated `PermissionsTemplate` with consistent progress bar styling and back button
- 2025-12-01: Updated `SetupQuestionsTemplate` with consistent progress bar styling and back button
- 2025-12-01: Removed extra `marginTop` from `DailyRhythmTemplate` progressTrack
- 2025-12-01: Updated all 12 onboarding page files with explicit back navigation

## Verification

- `pnpm check-types` - Passed (no errors)
- `read_lints` on all modified files - No linter errors found

## Outcomes

### Files Modified

**Constants:**
- `apps/mobile/src/constants/onboarding.ts` - Added `permissions: 1`, shifted all steps, total = 12

**Templates:**
- `apps/mobile/src/components/templates/PermissionsTemplate.tsx` - Added onBack prop, unified header/progress styling
- `apps/mobile/src/components/templates/SetupQuestionsTemplate.tsx` - Added onBack prop, unified header/progress styling
- `apps/mobile/src/components/templates/DailyRhythmTemplate.tsx` - Removed marginTop from progressTrack

**Pages (all with explicit back navigation):**
- `apps/mobile/src/app/permissions.tsx` → back to `/signup`
- `apps/mobile/src/app/setup-questions.tsx` → back to `/permissions`
- `apps/mobile/src/app/daily-rhythm.tsx` → back to `/setup-questions`
- `apps/mobile/src/app/joy.tsx` → back to `/daily-rhythm`
- `apps/mobile/src/app/drains.tsx` → back to `/joy`
- `apps/mobile/src/app/your-why.tsx` → back to `/drains`
- `apps/mobile/src/app/focus-style.tsx` → back to `/your-why`
- `apps/mobile/src/app/coach-persona.tsx` → back to `/focus-style`
- `apps/mobile/src/app/morning-mindset.tsx` → back to `/coach-persona`
- `apps/mobile/src/app/goals.tsx` → back to `/morning-mindset`
- `apps/mobile/src/app/build-routine.tsx` → back to `/goals`
- `apps/mobile/src/app/ideal-day.tsx` → back to `/build-routine`

### Unified Progress Bar Style

All templates now use:
- Header: `Step X` (blue) `of Y` (gray) with optional back button
- Progress track: 6px height, #E4E8F0 background, #2563EB fill
- No extra margins between header and progress bar

## Follow-ups

- None identified





