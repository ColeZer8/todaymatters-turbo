# Development Summary — January 24, 2026

**Branch:** `ralph/calendar-actual-timeline-fix`  
**Prepared for:** Client update

---

## Overview

Today’s work focused on **making the calendar “Actual” timeline more accurate and trustworthy** by introducing a unified evidence fusion system; **diagnosing and fixing Android permission and evidence-collection issues** so location and screen time flow correctly on physical devices; and **streamlining Android production builds and release** for easier distribution and Play Store submission.

---

## 1. Unified Evidence Fusion Pipeline (US-024)

### What changed

The Actual timeline now uses a **single evidence fusion pipeline** that combines many data sources into one consistent, non-overlapping timeline. Previously, different evidence types were handled in a more fragmented way.

### Evidence sources (in priority order)

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | **User-created/edited** | Events the user manually adds or adjusts |
| 2 | **Previously saved (Supabase)** | Derived events already synced to the backend |
| 3 | **Planned cross-reference** | Late arrivals, different activities, distractions inferred from planned vs. actual |
| 4 | **Verification evidence** | Blocks from the verification engine |
| 5 | **Location** | Location-derived events |
| 6 | **Screen time** | App usage–based events |
| 7 | **Sleep** | Sleep-derived events |
| 8 | **Pattern suggestions** | Inferred from past behavior |
| 9 | **Unknown gaps** | Filled gaps when no other evidence exists |

### Benefits

- **Single source of truth:** One pipeline decides how evidence is merged, deduplicated, and ordered.
- **Clear priority rules:** User input wins; other sources are used only when user data isn’t present.
- **Overlap handling:** Conflicting time blocks are resolved by splitting or trimming lower-priority events around higher-priority ones.
- **Richer metadata:** Each event carries fusion metadata (e.g. source type, confidence, evidence description) to support future UI (e.g. “Why did we show this?”) and debugging.
- **Efficiency:** Fusion runs once per render instead of being scattered across multiple paths.

### Technical notes

- New types: `EvidenceSourceType`, `EvidenceFusionMetadata`, `EvidenceFusionPipelineInput` / `EvidenceFusionPipelineResult`.
- New helpers: `runEvidenceFusionPipeline()`, `classifyEventSource()`, `attachFusionMetadata()`, `logFusionPipelineStats()`.
- `buildActualDisplayEvents` now feeds all evidence into this pipeline, then runs gap-filling on the fused result.
- The events store (`CalendarEventMeta`) was extended with fusion-related fields (`sourceType`, `fusionId`, `fusedAt`, `evidenceDescription`, `isDerived`, `contributingSources`).
- Conflict detection now includes a `pattern` source type where relevant.

---

## 2. Android Build & Release Improvements

### Version & build configuration

- **Version code** bumped from `1` → `2` in `android/app/build.gradle` for the next store upload.
- **EAS production profile** updated so Android production builds produce an **App Bundle (AAB)** instead of an APK, which is required for Google Play Console uploads.

### New automation scripts

| Script | Purpose |
|--------|---------|
| **`download-aab.sh`** | Fetches the latest finished Android production build from EAS, downloads the AAB to `production-build.aab`, and confirms it’s ready for Play Console upload. |
| **`install-production-apk.sh`** | Polls EAS until the latest Android build completes, downloads the APK, and installs it on a connected physical device via `adb`. Useful for quick QA installs. |

These live in `apps/mobile/` and can be run from that directory.

---

## 3. Android Permission Debugging & Evidence Collection Fixes (US-001, US-002)

### The problem

On **physical Android devices** (including production builds from Play Console internal testing), evidence data—**location** and **screen time**—was not being pulled into the app, even when users had granted all requested permissions (Usage Access, Location). The same flow worked on the Android simulator, so the failure was specific to real devices and production builds.

### What we did

#### 1. Permission and API diagnostics

To figure out whether the failure was permission-related or elsewhere in the pipeline, we added **production-safe diagnostics**:

- **Usage Access (AppOps)**  
  - A new `getUsageStatsDiagnostics()` function in the Android native module checks:
    - **AppOps permission status** for `PACKAGE_USAGE_STATS` (Usage Access), with a human-readable mode (`MODE_ALLOWED`, `MODE_IGNORED`, etc.).
    - Device info (manufacturer, model, SDK version).
    - Usage-stats counts across daily, “best,” and weekly intervals.
    - Usage-events count (foreground/background).
    - Top app and foreground time.
    - Any errors from the Usage Stats API.
  - Results are exposed to the app via `getUsageStatsDiagnosticsAsync` and shown in the **dev/android-insights** screen (e.g. “Usage access granted: YES/NO” plus AppOps mode).
  - Kotlin logging uses a dedicated tag (`AndroidInsights`) so we can filter logcat on device: `adb logcat -s AndroidInsights`.

- **Location**  
  - **Android location diagnostics** were expanded to report:
    - Support status, presence of location module, location services enabled/disabled.
    - **Foreground and background location permission** status.
    - Whether the background location task has started, pending sample count, and any blocking issues.
  - `getAndroidLocationDiagnostics()` is used by the **Profile** screen’s “Android Location Diagnostics” action, which shows a concise summary (including both permission states) and any errors.
  - We also improved **background permission handling**: `getBackgroundPermissionsSafeAsync` catches failures when checking background location (e.g. on some devices/Android versions) and returns a safe fallback instead of throwing, so the app doesn’t crash and we can still log or show “unknown” when needed.

#### 2. Root cause: sync, not permissions

Diagnostics showed that **permissions were correctly granted** (Usage Access and Location both allowed). The real bug was in **evidence sync**:

- **Android screen-time sessions** were never being synced to Supabase. The sync code was calling `replaceAppSessions(dailyId, [])`, which always cleared sessions instead of uploading the session data produced by the native module.
- We fixed this by implementing proper **Android session syncing** and **hourly sync** (aligned with iOS), plus production logging along the sync path. Evidence now flows from device → TypeScript → Supabase as intended.

So the “permission issues” were largely **visibility** (we couldn’t easily confirm permission state on device) and **misattribution** (we suspected permissions first). The diagnostics let us verify permissions quickly and then trace the failure to the sync layer.

#### 3. Permission flows and user guidance

- **Profile screen**  
  - **Location:** “Request location” triggers `requestAndroidLocationPermissionsAsync()` (foreground, then background) and shows the resulting foreground/background status.  
  - **Android Location Diagnostics:** Runs `getAndroidLocationDiagnostics()` and displays the summary (including both permission states) and any blocking issues.
- **Usage Access (Android)**  
  - When syncing screen time, we check `getUsageAccessAuthorizationStatusSafeAsync()`. If not `authorized`, we **open Usage Access settings** and show an alert telling the user to enable Usage Access for TodayMatters and retry. This makes it clear that Usage Access must be granted in a separate system screen, not via a normal runtime permission.
- **Permissions screen (onboarding)**  
  - On Android, toggling “App usage” can open the **Usage Access** settings screen directly (not generic Settings) so users know exactly where to enable it.

### Takeaways

- **AppOps vs. runtime permissions:** Usage Access is an **AppOps** permission. We now check it explicitly and surface it in diagnostics (including mode string) so we can distinguish “granted,” “ignored,” “default,” etc.
- **Location:** Checking **foreground vs. background** separately is important; we log both and handle background check failures gracefully.
- **Diagnostics first:** Adding permission and API diagnostics (AppOps, location, usage stats) allowed us to confirm that permissions were fine and to quickly narrow the bug to the sync pipeline. We’ll keep these diagnostics available for future Android issues.
- **Sync parity:** Android screen-time sync (sessions + hourly) now matches iOS behavior, and both are covered by production logging for easier debugging.

### Files involved

- `apps/mobile/modules/android-insights/` — Kotlin `getUsageStatsDiagnostics()`, AppOps checks, TypeScript exports; dev screen usage diagnostics UI.
- `apps/mobile/src/lib/android-location/index.ts` — `getBackgroundPermissionsSafeAsync`, `getAndroidLocationDiagnostics`, logging.
- `apps/mobile/src/app/dev/android-insights.tsx` — Diagnostics UI (Usage Access status, AppOps mode, etc.).
- `apps/mobile/src/app/profile.tsx` — “Request location,” “Android Location Diagnostics,” and Usage Access guidance.
- `apps/mobile/src/app/permissions.tsx` — Usage Access settings deep-link on Android.
- `apps/mobile/src/lib/supabase/services/screen-time-sync.ts` — Android session + hourly sync fix (US-002).
- `apps/mobile/src/lib/supabase/hooks/use-insights-sync.ts` — Usage Access check, logging.

---

## 4. Summary of Files Touched

| File | Changes |
|------|---------|
| `apps/mobile/src/lib/calendar/actual-display-events.ts` | Evidence fusion pipeline (US-024): types, pipeline logic, integration into `buildActualDisplayEvents`, plus `pattern` in conflict source. |
| `apps/mobile/src/stores/events-store.ts` | Extended `CalendarEventMeta` with fusion metadata fields. |
| `apps/mobile/android/app/build.gradle` | `versionCode` 1 → 2. |
| `apps/mobile/eas.json` | Production Android profile: `buildType: "app-bundle"`. |
| `apps/mobile/download-aab.sh` | **New.** Download latest production AAB for Play Store. |
| `apps/mobile/install-production-apk.sh` | **New.** Wait for build, download APK, install on device via `adb`. |
| **Android permission & evidence (US-001, US-002)** | |
| `apps/mobile/modules/android-insights/` (Kotlin + TS) | `getUsageStatsDiagnostics()`, AppOps Usage Access checks, TypeScript exports. |
| `apps/mobile/src/lib/android-location/index.ts` | `getBackgroundPermissionsSafeAsync`, `getAndroidLocationDiagnostics`, logging. |
| `apps/mobile/src/app/dev/android-insights.tsx` | Diagnostics UI: Usage Access status, AppOps mode, session counts. |
| `apps/mobile/src/app/profile.tsx` | Request location, Android Location Diagnostics, Usage Access guidance. |
| `apps/mobile/src/app/permissions.tsx` | Usage Access settings deep-link on Android. |
| `apps/mobile/src/lib/supabase/services/screen-time-sync.ts` | Android session + hourly sync fix. |
| `apps/mobile/src/lib/supabase/hooks/use-insights-sync.ts` | Usage Access check, production logging. |

---

## Next Steps (Recommendations)

- **QA:** Exercise the Actual timeline with mixed evidence (user edits, locations, screen time, etc.) and confirm no overlaps, sensible priorities, and correct gap-filling.
- **Play Store:** Use `download-aab.sh` after a production EAS build, then upload the AAB to Google Play Console.
- **Optional:** Add UI (e.g. in event detail) to show fusion metadata (`evidenceDescription`, `sourceType`) so users can understand where an event came from.
- **Android debugging:** If evidence fails on a physical device, use Profile → “Android Location Diagnostics” and dev/android-insights (Usage Access, AppOps) to verify permissions and API state before digging into sync or backend.

---

*This summary reflects uncommitted work on `ralph/calendar-actual-timeline-fix` as of January 24, 2026.*
