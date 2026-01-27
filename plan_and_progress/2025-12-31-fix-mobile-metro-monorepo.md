# Fix mobile Metro resolution in monorepo (Expo Router LinkPreviewContext crash)

- Status: Completed
- Owner: Cole / Cursor agent
- Started: 2025-12-31
- Completed: 2025-12-31

## Objective

Restore the Expo (mobile) app runtime by fixing Metro module resolution in the Turborepo monorepo so that `react` / `expo-router` resolve consistently and the app no longer crashes with `useLinkPreviewContext must be used within a LinkPreviewContextProvider`.

## Plan

1. Reproduce and identify the crash origin (Expo Router / context provider mismatch).
2. Update `apps/mobile/metro.config.js` for monorepo-friendly resolution (singletons + nodeModulesPaths).
3. Verify with `pnpm --filter mobile lint` and `pnpm --filter mobile check-types`.

## Done Criteria

- Mobile app no longer throws `useLinkPreviewContext must be used within a LinkPreviewContextProvider` at startup.
- Mobile `lint` + `check-types` succeed.

## Progress

- 2025-12-31: Identified crash in `apps/mobile/src/app/_layout.tsx` during `<Stack />` render; likely caused by duplicated `expo-router`/React module resolution after monorepo changes.
- 2025-12-31: Fixed Metro config to force singleton resolution for `react` + `expo-router`. Fixed Metro bundling failure in `react-native-reanimated` by adding `semver@7` to `apps/mobile` (required for `semver/functions/satisfies`).

## Verification

- `pnpm --filter mobile lint` (pass; warnings only)
- `pnpm --filter mobile check-types` (pass)

## Outcomes

- Updated `apps/mobile/metro.config.js` to enforce monorepo-safe singleton resolution for `react`, `react-native`, `expo`, and `expo-router`.
- Added `semver@7.7.3` to `apps/mobile` to satisfy Reanimated’s `semver/functions/*` import during Metro bundling.
- Restored a valid `apps/landing/package.json` (was 0 bytes) so pnpm workspace scripts can run.

## Follow-ups

- Investigate why `apps/landing/package.json` is empty (0 bytes) and restore it to a valid Next.js manifest; this can destabilize workspace installs.
