# Android Location Collection (Production Plan)

This document captures the **Android-specific** requirements to collect background location in our Expo app, matching the iOS pipeline (raw samples → hourly aggregation in Postgres).

## Official Documentation (Source of Truth)

- **Expo Location**: `https://docs.expo.dev/versions/latest/sdk/location/`
- **Expo TaskManager**: `https://docs.expo.dev/versions/v54.0.0/sdk/task-manager`
- **Android background location**: `https://developer.android.com/training/location/permissions`
- **Android foreground services**: `https://developer.android.com/develop/background-work/foreground-services`

## Key Android Differences vs iOS

- **Foreground service required** for reliable background location: Android requires a persistent notification while tracking.
  - Expo supports this via `Location.startLocationUpdatesAsync(..., { foregroundService: { notificationTitle, notificationBody, ... } })`.
- **Permissions**: Android needs manifest permissions (and runtime prompts) for:
  - `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
  - `ACCESS_BACKGROUND_LOCATION` (background)
  - `FOREGROUND_SERVICE` and (Android 14+) `FOREGROUND_SERVICE_LOCATION`

## Storage Model

Android uses the same `tm.location_samples` table and the same upload dedupe strategy as iOS:

- Client batches samples locally first, then upserts to Supabase with `onConflict: user_id,dedupe_key`.
- Server-side view `tm.location_hourly` provides an hour-by-hour centroid + radius for schedule comparison.
