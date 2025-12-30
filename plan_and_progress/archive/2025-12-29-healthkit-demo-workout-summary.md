# HealthKit — Wire Real Data into Demo Workout Summary Screen

- Status: Completed
- Owner: Cursor Agent
- Started: 2025-12-29
- Completed: 2025-12-29

## Objective

Replace hardcoded demo metrics in the “Great workout” screen (`/demo-workout-summary`) with real HealthKit data, and ensure the Health permission prompt is triggered from this screen.

## Plan

1. Add native HealthKit APIs to read:
   - authorization status
   - today Activity rings (HKActivitySummary)
   - most recent workout + heart rate stats
2. Update JS wrappers under `apps/mobile/src/lib/ios-insights`.
3. Update the page `apps/mobile/src/app/demo-workout-summary.tsx` to own permission + data fetching and pass data to the organism.
4. Update `DemoWorkoutSummary` organism to render passed-in data (keep UI-only interactions).

## Done Criteria

- Tapping “Connect Health” shows the Apple Health permission sheet (first run).
- After approval, the screen fills with real values when available, and shows clear “no data” messaging when not.
- `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` pass.

## Progress

- 2025-12-29:
  - Added HealthKit APIs in `ios-insights` for:
    - authorization status
    - today Activity rings summary (HKActivitySummaryQuery)
    - latest workout summary (incl. avg/max HR stats when available)
  - Updated `/demo-workout-summary` to show a clear “Connect Health” CTA and fetch real values into the UI.

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅

## Outcomes

- Demo Workout Summary screen now triggers HealthKit authorization and renders real HealthKit values when available.


