# Fix physical-device crash: missing ExpoTaskManager

- Status: In Progress
- Owner: Cole
- Started: 2026-01-14
- Completed: -

## Objective

Prevent the app from hard-crashing on physical iOS devices when the installed dev client/build is missing the `ExpoTaskManager` native module, while keeping background location tasks working in builds that include it.

## Plan

1. Remove any module-scope imports that pull in `expo-task-manager` during app bootstrap.
2. Guard task definitions so they only run when `ExpoTaskManager` is present.
3. Verify with TypeScript + reloading Metro, then validate on physical device.

## Done Criteria

- App boots on physical device without `Cannot find native module 'ExpoTaskManager'`.
- No unexpected regressions in background location task registration when native modules exist.

## Progress

- 2026-01-14: Moved background task name constants to `task-names.ts` to avoid importing `location-task.ts` during bootstrap; guarded task definitions using `requireOptionalNativeModule('ExpoTaskManager')`.

## Verification

- `pnpm --filter mobile check-types` (pass)
- Pending: Reload app on physical device and confirm crash is gone.

## Outcomes

- `apps/mobile/src/lib/{ios-location,android-location}/index.ts` no longer imports `location-task.ts` at module scope.
- `apps/mobile/src/lib/{ios-location,android-location}/location-task.ts` defines tasks only when `ExpoTaskManager` exists.

## Follow-ups

- If physical device is running an older dev client, rebuild/reinstall dev client so background location can be enabled there too.

