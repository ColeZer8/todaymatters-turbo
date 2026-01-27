# Screen Time — Native Module Not Loading / Misleading “Unsupported” State

- Status: Completed
- Owner: Cursor Agent
- Started: 2025-12-29
- Completed: 2025-12-29

## Objective

Fix the Screen Time demo UX so it reports the **real root cause** when Screen Time isn’t working (Expo Go vs stale dev client vs actual native error), instead of collapsing all failures into “Native iOS module not loaded”.

## Plan

1. Trace the `demo-screen-time` flow into the `ios-insights` Expo module.
2. Add a robust “native module available?” signal + clearer error for out-of-date native builds.
3. Update demo/dev screens to display actionable errors (and only show “unsupported” when truly missing).

## Done Criteria

- Demo screen shows a precise reason:
  - Running in Expo Go / StoreClient
  - Native module missing from build (stale dev client)
  - Native module present but failing (shows error string)
- `pnpm --filter mobile check-types` and `pnpm --filter mobile lint` pass.

## Progress

- 2025-12-29:
  - Identified root issue: `apps/mobile/src/lib/ios-insights/*SafeAsync` wrappers swallowed all errors and returned `unsupported`, causing misleading “module not loaded” messaging.
  - Added `isIosInsightsNativeModuleAvailable()` + “missing method” stale-build error message in `ios-insights`.
  - Added `getIosInsightsSupportStatus()` to distinguish Expo Go vs missing native module vs available.
  - Updated `/demo-screen-time` to surface underlying errors in the UI.

## Verification

- `pnpm --filter mobile check-types` ✅
- `pnpm --filter mobile lint` ✅

## Outcomes

- Screen Time demo now explains the real failure mode (Expo Go vs stale dev client vs native error) instead of always claiming the native module isn’t loaded.

## Follow-ups

- If you hit `missingNativeModule`: run `pnpm --filter mobile ios`, install the dev client, and reopen the installed app.
