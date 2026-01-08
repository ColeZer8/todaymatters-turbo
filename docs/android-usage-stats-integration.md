# Android App Usage (Screen Time-ish) — Integration Notes (TodayMatters)

Android does not offer an exact equivalent to Apple’s **FamilyControls + DeviceActivity** “Screen Time” stack, but we can get close using:
- **UsageStatsManager** (per-app usage time)
- “Usage Access” (user-granted access in settings)

## Official references (source of truth)

- UsageStatsManager API (Kotlin): `https://developer.android.com/reference/kotlin/android/app/usage/UsageStatsManager`
- UsageStats data model: `https://developer.android.com/reference/kotlin/android/app/usage/UsageStats`
- Settings entry point for usage access: `https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS`

## What Android actually provides for “screen time”

UsageStats can provide:
- per-app foreground time (depending on OS version/manufacturer)
- aggregated totals for a time window (today/week/month/year) via query APIs

Important nuance:
- The user must enable “Usage Access” for our app in system settings.
- Some OEMs restrict or skew results; we must handle missing data gracefully.

## Permissions model

There is a protected permission:
- `android.permission.PACKAGE_USAGE_STATS`

This is not a normal runtime permission prompt:
- the user grants access via Settings → “Usage access”
- we can deep-link into the settings screen and then re-check status

## Implementation approach (code structure)

We will mirror iOS “Screen Time summary” at the data-contract level:
- A normalized `UsageSummary` type with:
  - generatedAt timestamp
  - window start/end
  - total seconds
  - top apps list (packageName + label + durationSeconds)

We will implement this inside:
- `apps/mobile/modules/android-insights/` (native Kotlin)
- exposed through a JS wrapper in `apps/mobile/src/lib/android-insights`

## Testing workflow

1. Build a dev client (not Expo Go).
2. Navigate to the in-app surface that requests usage access.
3. Tap CTA → open Settings usage access screen.
4. Enable usage access for TodayMatters.
5. Return to the app and pull:
   - today summary
   - top apps list

## Known limitations (vs iOS)

- No DeviceActivity report extension equivalent.
- “Pickups” is not consistently available like iOS.
- Hourly buckets may be approximated or omitted depending on platform behavior.


