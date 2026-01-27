# Android Health Connect — Integration Notes (TodayMatters)

This doc mirrors our iOS `HealthKit` integration notes, but for **Android**. The Android “source of truth” for health data is now **Health Connect**.

## Official references (source of truth)

- Health Connect overview: `https://developer.android.com/health-and-fitness/guides/health-connect`
- Get started (integration): `https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started`
- Data types: `https://developer.android.com/health-and-fitness/guides/health-connect/data-types`
- Codelab: `https://developer.android.com/codelabs/health-connect`

## What Android actually provides for “health data”

Health Connect is a **platform layer** that aggregates data from multiple apps (Fitbit, Samsung Health, etc.) and exposes it through a single API, gated by user permissions.

Important nuance:

- There is no “give me everything” permission. Permissions are **per record type** (steps, heart rate, sleep, etc.).
- Device/emulator might have **no health data** unless you seed it (see Testing).

## Device support / availability model

Health Connect availability depends on OS version and user setup:

- **Android 14+**: Health Connect is integrated into system settings.
- **Android 13 and below**: User may need the **Health Connect app** installed.

We should expose a JS method in `android-insights` to:

- detect whether Health Connect is available
- deep-link the user to install/enable/update if needed

## Permissions model

Health Connect uses a permission model that is distinct from normal runtime permissions:

- You request access to specific record types (steps, sleep, heart rate, etc.) via the Health Connect client APIs.
- Some implementations also require declaring permissions in the Android manifest depending on API level and SDK behavior.

In this repo we will:

- Declare the necessary permissions in `app.config.js` (Android section) via an Android-only config plugin.
- Keep the “real” Health Connect permission request inside the native module (`android-insights`) so behavior is centralized and typed.

## TodayMatters target signals (Android parity with iOS HealthKit set)

Match the iOS `HealthSummary` contract as closely as possible:

- Steps (sum)
- Active energy (kcal) (if available via Health Connect on target devices)
- Distance walking/running (meters) (if available)
- Heart rate avg (bpm) (if available)
- Resting heart rate avg (bpm) (if available)
- HRV (if available)
- Sleep duration (seconds) (if available)
- Workouts count + total duration (if available)

If a metric is unavailable on Android, we should return `null` for that field (same contract shape).

## Implementation approach (code structure)

We will mirror the iOS pattern:

- **Local Expo module**: `apps/mobile/modules/android-insights/` (Kotlin)
- **App wrapper**: `apps/mobile/src/lib/android-insights/` (platform gating + range helpers)
- **Unified wrapper**: `apps/mobile/src/lib/insights/` (iOS delegates to `ios-insights`, Android delegates to `android-insights`)

This ensures iOS remains unchanged and Android gets added cleanly.

## Testing workflow (Android)

Recommended approach:

- Use a physical device when possible (health data tends to be richer).
- Install / enable Health Connect (system-integrated or app-installed).
- Seed test data:
  - Use Google’s “Health Connect” dev tooling or compatible health apps to generate sample records.
  - Confirm records exist in Health Connect UI before debugging code.

## Common pitfalls

- Running in **Expo Go** will not include custom native modules; use a dev build (`pnpm --filter mobile android`).
- Health Connect might be “available” but have **zero records**.
- Users can grant partial permissions; treat “some granted” as connected, but keep nulls for missing signals.
