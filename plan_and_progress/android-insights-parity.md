# Android Insights Parity (Health Connect + Usage Stats)

- Status: In Progress
- Owner: Cole + Cursor
- Started: 2026-01-07
- Completed: -

## Objective

Bring TodayMatters to functional parity on **Android** for “pulling data from the phone”, analogous to our iOS `ios-insights` integration:

- Health signals (steps, sleep, heart rate, etc.) via **Health Connect**
- Digital wellbeing / “screen time-ish” signals via **UsageStatsManager**

Keep **iOS behavior unchanged** while we add Android support.

## Plan

1. Add official documentation notes + constraints to `/docs` (Health Connect + UsageStats).
2. Add a new local Expo module: `apps/mobile/modules/android-insights` (Kotlin).
3. Add an Android-only config plugin to declare required permissions and wire it into `apps/mobile/app.config.js`.
4. Add a platform-agnostic JS wrapper under `apps/mobile/src/lib/insights` so screens can call one API.
5. Migrate only the Android-relevant screens (Health category first; then Calendar/Screen Time surfaces) to the new wrapper with **no iOS regressions**.
6. Verify via `pnpm --filter mobile lint` + `pnpm --filter mobile check-types`, then build/run on Android device/emulator.

## Done Criteria

- Android dev build runs (`pnpm --filter mobile android`) without iOS regressions.
- Health Connect:
  - Detect availability + prompt user to install/enable if needed
  - Request permission for steps + read step count for a date range
- Usage stats:
  - Deep link user to enable “Usage Access”
  - Read basic “today total + top apps” summary
- iOS:
  - `ios-insights` remains intact and screens still behave the same on iOS

## Progress

- 2026-01-07:
  - Added `android-insights` local Expo module + Android-only config plugin.
  - Implemented Android Usage Stats summary (UsageStatsManager) and Health Connect steps aggregation (via `HealthConnectClient.aggregate`).
  - Added dev screen `/dev/android-insights` for on-device validation.
  - Verified: `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` pass.

- 2026-01-08:
  - Fixed Android dev build by setting Android `minSdkVersion` to 26 via `expo-build-properties` (required by Health Connect), then re-running `expo prebuild`.
  - Fixed autolinking by using the fully-qualified module class name in `apps/mobile/modules/android-insights/expo-module.config.json` and regenerating Android native files.
  - Expanded Health Connect reads: heart rate avg, sleep duration, and workouts count/duration are now included in `getHealthSummaryJson` and shown on `/dev/android-insights`.

## Verification

- (pending) `pnpm --filter mobile lint`
- (pending) `pnpm --filter mobile check-types`
- (done) `pnpm --filter mobile android:dev`
- (pending) Manual QA on Android device: grant Health Connect permissions for steps/sleep/heart rate/exercise + validate data reads

## Outcomes

- (pending) Android insights module + plugin + unified wrapper

## Follow-ups

- Add Health Connect “toolbox” testing flow (inject sample data) and document it.
- Decide how to normalize “screen time” semantics across iOS Screen Time vs Android usage stats.
