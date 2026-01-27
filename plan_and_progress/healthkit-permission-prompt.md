# HealthKit permission prompt + read access verification

- Status: In Progress
- Owner: Cursor (GPT-5.2)
- Started: 2025-12-29
- Completed: -

## Objective

Ensure iOS HealthKit authorization prompts appear (no crash) and the app can read Health data via the existing `ios-insights` native module.

## Plan

1. Verify the correct iOS app target `Info.plist` contains required HealthKit purpose strings.
2. Verify HealthKit entitlement is present for the app target.
3. Run TypeScript typecheck and confirm the app builds after changes.
4. Manual QA: rebuild iOS dev client and confirm the Health permission prompt appears when tapping "Connect Health".

## Done Criteria

- App no longer crashes when requesting HealthKit authorization.
- iOS shows the Health permission prompt at first request.
- HealthKit authorization status can be read and displayed in the dev/demo screens.

## Progress

- 2025-12-29: Found `apps/mobile/ios/mobile/Info.plist` missing `NSHealthShareUsageDescription` (crash root cause). Added HealthKit purpose strings + `NSFamilyControlsUsageDescription`.
- 2025-12-29: Fixed iOS build errors in `modules/ios-insights/ios/IosInsightsModule.swift` (unsupported HealthKit symbols + iOS 16-only sleep constants) and unblocked install by removing `NSExtensionPrincipalClass` from the DeviceActivity report extension `Info.plist`.
- 2025-12-29: Updated `/demo-workout-summary` to better populate **Calories** and **Exercise** from available HealthKit sources (fallback to daily active energy + workout duration when rings/workout energy are unavailable) and removed hardcoded placeholders in the UI.

## Verification

- `pnpm --filter mobile check-types` ✅

## Outcomes

- Added required iOS purpose strings to `apps/mobile/ios/mobile/Info.plist` so HealthKit permission requests won’t crash.

## Follow-ups

- Rebuild iOS dev client (`pnpm --filter mobile ios`) and confirm the Health prompt appears on device/simulator.
