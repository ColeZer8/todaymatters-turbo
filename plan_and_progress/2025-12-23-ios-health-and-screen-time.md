# iOS HealthKit + Screen Time (FamilyControls) Integration

- Status: In Progress
- Owner: Cursor Agent
- Started: 2025-12-23
- Completed: -

## Objective

Enable TodayMatters iOS builds to pull on-device signals:
- Health metrics via HealthKit (e.g., steps / sleep / heart rate samples).
- Digital wellbeing signals via Apple's Screen Time APIs (FamilyControls + DeviceActivity + ManagedSettings).

All integration must be implemented safely:
- No breaking changes to existing app flows.
- Uses official Apple + Expo docs.
- Respects our project structure (Turborepo workspace + Expo app boundaries).

## Plan

1. Confirm official requirements (entitlements, Info.plist usage strings, iOS availability) for HealthKit + Screen Time.
2. Add a workspace Expo Module package for native iOS functionality (and safe no-op behavior on unsupported platforms).
3. Wire config plugin(s) into `apps/mobile/app.config.js` to set required entitlements and usage strings.
4. Add a small debug screen in the app to request permissions + display sample outputs (kept off critical paths).
5. Verify with `pnpm lint` + `pnpm check-types` (scoped to mobile).

## Done Criteria

- HealthKit authorization + at least one read query works (returns data or a clear permission error).
- Screen Time authorization works and returns correct status on iOS 15+ (clear error on older iOS).
- Required iOS entitlements and Info.plist strings are present via config plugin.
- No changes to existing onboarding / home / core navigation behavior.
- `pnpm lint -- --filter=mobile` and `pnpm check-types -- --filter=mobile` pass.

## Progress

- 2025-12-23:
  - Added local Expo module `apps/mobile/modules/ios-insights` (HealthKit + FamilyControls auth/status).
  - Added iOS config plugin `apps/mobile/plugins/with-ios-insights.js` to set entitlements + usage strings.
  - Added dev validation route `/dev/ios-insights`.
  - Added Device Activity Report Extension target `IosInsightsReport` (iOS 16+) embedded into the app.
  - Added demo route `/demo-screen-time` rendering "Today total screen time + top 5 apps" in our analytics styling.
  - Implemented report aggregation in the extension and caching via App Group for RN rendering.

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅
- `pod install` (ios) ✅
- `pnpm --filter mobile ios --no-install` ✅ (build + install on simulator)

## Outcomes

- HealthKit access is implemented (authorization + step count sum query).
- Screen Time authorization is implemented with iOS 16+ async API and iOS 15.x fallback API.
- Device Activity Report Extension aggregates today total + top 5 apps and caches summary for the RN demo screen.

## Follow-ups

- Decide the exact “screen time info” UX/data shape we want (reports vs. monitoring + thresholds).
- Add a formal Settings permission screen entry and connect to onboarding preferences once behavior is validated.

