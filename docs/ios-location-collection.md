# iOS Location Collection (Production Plan)

This document captures the **officially supported** path to collect iOS location data in our Expo app, plus the recommended storage model for “planned day vs actual day” comparisons.

## Official Documentation (Source of Truth)

- **Expo Location (SDK v54)**: `https://docs.expo.dev/versions/latest/sdk/location/`
- **Expo TaskManager (SDK v54)**: `https://docs.expo.dev/versions/v54.0.0/sdk/task-manager`
- **Apple Core Location overview (archived guide)**: `https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/LocationAwarenessPG/CoreLocation/CoreLocation.html`
- **Apple energy best practices for location**: `https://developer.apple.com/library/archive/documentation/Performance/Conceptual/EnergyGuide-iOS/LocationBestPractices.html`

## Why we’re using Expo’s Background Location Task

We need an **hour-by-hour trace** of where the user was so we can infer “meeting vs lunch vs commute” and compare it to their calendar/schedule.

Expo’s supported, production-grade approach for background location is:

- `expo-location` to request permissions + start background updates
- `expo-task-manager` to define and receive background task callbacks (`TaskManager.defineTask`)
- iOS config updates:
  - Info.plist usage strings: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`
  - Background mode: `UIBackgroundModes` includes `location`

## Data Strategy (Battery + UX + Fidelity)

We store **raw location samples** (lat/lng + accuracy + timestamp) and derive “stays/visits” and “hourly summaries” server-side.

### Collection defaults (recommended)

- **Accuracy**: Balanced (enough for venue-level clustering; avoids GPS burn).
- **Distance gating**: collect only when moved meaningfully (e.g. 50–100m).
- **Deferred delivery**: let iOS batch updates for efficiency (Expo location task options support iOS deferral).
- **Local queue first**: background task writes to local storage; upload happens when app is foreground + authenticated.

Rationale:

- Background tasks can fire with limited network/time.
- We must avoid losing data when offline.
- Hour-level analysis does not require sub-second sampling.

## Storage Model in Postgres / Supabase

### Raw samples table (immutable)

- One row per sample.
- Keep it append-only with a **dedupe key** to avoid duplicates on retry.

### Hourly summary (view or materialized view)

- `date_trunc('hour', recorded_at)` bucket
- sample count, centroid, radius/dwell heuristics
- Later: join with user-defined places / geofences to label “office”, “gym”, “restaurant”, etc.

## Security / Privacy Notes

- Request **When In Use** first, then **Always** if the user opts in to “Compare planned vs actual day”.
- Provide clear copy explaining:
  - What we store (location samples)
  - Why (match schedule to reality)
  - How it’s protected (RLS + encryption at rest)
  - How to disable (system settings + app toggle)
