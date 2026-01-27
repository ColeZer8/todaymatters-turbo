# HealthKit — Real iOS Health Data in App

- Status: Completed
- Owner: Cursor Agent
- Started: 2025-12-29
- Completed: 2025-12-29

## Objective

Replace placeholder “health” UI with **real HealthKit data** on iOS by extending our existing `ios-insights` Expo native module and wiring it into an existing screen.

## Plan

1. Review official Apple HealthKit docs (authorization + querying) and record links/notes under `/docs`.
2. Extend `apps/mobile/modules/ios-insights` HealthKit implementation to fetch a multi-metric summary over a date range.
3. Update the existing iOS Insights dev screen (and/or the Health category screen) to display real values and permission states.

## Done Criteria

- HealthKit permission prompt requests a sane, explicit set of read types (steps, sleep, energy, distance, heart, workouts).
- App can fetch and render a “Health Summary” for a selected range (today/week/month/year) on iOS.
- Clear empty-state messaging on simulator (no data unless added in Health app) and on-device works with real data.
- `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` pass.

## Progress

- 2025-12-29:
  - Added `docs/healthkit-integration.md` with official Apple + Expo references.
  - Extended `ios-insights` HealthKit native module:
    - broader read authorization (steps, sleep, energy, distance, heart metrics, workouts)
    - `getHealthSummaryJson` returning a multi-metric summary for a selected date range
  - Wired real data into:
    - `/category/health` via `HealthKitDashboardTemplate`
    - `/dev/ios-insights` summary fetch controls

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅

## Outcomes

- The Health category screen now displays real HealthKit metrics on iOS once authorized.

## Follow-ups

- Consider background delivery / observer queries once we decide which metrics drive product features.
