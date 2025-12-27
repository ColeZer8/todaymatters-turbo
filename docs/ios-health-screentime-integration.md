# iOS HealthKit + Screen Time (FamilyControls) — Implementation Notes

This doc records how we integrate **HealthKit** and **Apple Screen Time APIs** into the TodayMatters Expo app, using **official Apple + Expo guidance** and keeping our project boundaries intact (Pages own behavior; lower layers stay presentational).

## What Apple actually provides for “Screen Time”

Apple’s supported way for third-party apps to work with “Screen Time” is via these frameworks:

- **FamilyControls**: request user authorization and select apps/categories for monitoring and restrictions  
  Docs: `https://developer.apple.com/documentation/familycontrols`
- **DeviceActivity**: schedule monitoring and (via a separate report extension) produce usage reports  
  Docs: `https://developer.apple.com/documentation/deviceactivity`
- **ManagedSettings**: apply shields/restrictions to selected apps/categories  
  Docs: `https://developer.apple.com/documentation/managedsettings`

Important nuance: **per-app usage “reports” are produced by a Device Activity report extension** (SwiftUI) that runs sandboxed.  
Apple docs: `https://developer.apple.com/documentation/deviceactivity/deviceactivityreport`

## HealthKit

HealthKit provides read/write access to health data (with explicit user permission):

- HealthKit docs: `https://developer.apple.com/documentation/healthkit`
- Getting started: `https://developer.apple.com/documentation/healthkit/getting_started_with_healthkit`

### Required Info.plist keys

HealthKit authorization prompts require:
- `NSHealthShareUsageDescription`
- `NSHealthUpdateUsageDescription` (only if writing)

## Expo Modules approach (project structure)

We implement native functionality as a **local Expo Module** so:
- native code stays isolated (no random edits inside the app runtime)
- JS API is typed and easy to wrap with app-specific helpers
- the module is autolinked by Expo’s module system

Official Expo docs:
- Expo Modules API get started: `https://docs.expo.dev/modules/get-started/`
- Module config (`expo-module.config.json`): `https://docs.expo.dev/modules/module-config/`

### Where the code lives

- **Local module**: `apps/mobile/modules/ios-insights/`
  - JS API: `apps/mobile/modules/ios-insights/src/index.ts`
  - iOS Swift module: `apps/mobile/modules/ios-insights/ios/IosInsightsModule.swift`
  - Module config: `apps/mobile/modules/ios-insights/expo-module.config.json`
- **App wrapper** (app-specific ergonomics): `apps/mobile/src/lib/ios-insights/`
- **Dev-only validation screen**: `apps/mobile/src/app/dev/ios-insights.tsx`

## Entitlements + iOS usage strings (Expo config plugin)

We set entitlements and usage strings via a config plugin:
- plugin: `apps/mobile/plugins/with-ios-insights.js`
- wired in: `apps/mobile/app.config.js`

This plugin adds:
- Entitlements:
  - `com.apple.developer.healthkit`
  - `com.apple.developer.family-controls`
- Info.plist strings:
  - `NSHealthShareUsageDescription`
  - `NSHealthUpdateUsageDescription`
  - `NSFamilyControlsUsageDescription`

## Current capabilities (what’s implemented now)

### HealthKit
- Request authorization (read access to a small set: steps, heart rate, sleep, active energy)
- Query **step count sum** for a time range

### Screen Time APIs
- Read current authorization status
- Request authorization
  - iOS 16+: `AuthorizationCenter.shared.requestAuthorization(for: .individual)`
  - iOS 15.x: `AuthorizationCenter.shared.requestAuthorization { ... }`

## Device Activity Report Extension (added)

We added a minimal **DeviceActivity report extension** target so the app can render Screen Time usage reports the Apple-supported way.

- **Extension point**: `com.apple.deviceactivityui.report-extension`  
  Apple docs: `https://developer.apple.com/documentation/deviceactivity/deviceactivityreport`
- **Minimum iOS**: iOS 16.0+ (required for `DeviceActivityReportScene` APIs)

Code lives at:
- `apps/mobile/ios/IosInsightsReport/IosInsightsReportExtension.swift`
- `apps/mobile/ios/IosInsightsReport/Info.plist`

Current report implementation is intentionally minimal: it returns a placeholder string so we can validate the extension is built, embedded, signed, and invokable. Next step is to evolve the report configuration to produce per-app totals and a richer SwiftUI view.


