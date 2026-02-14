# iOS Preview Permissions Build v2

- Status: In Progress
- Owner: Codex
- Started: 2026-02-13
- Completed: -

## Objective

Bump iOS version/build again and produce a new preview build that includes the latest permission-flow fixes for Health and Screen Time.

## Plan

1. Bump app + native iOS versions/build numbers.
2. Verify resolved EAS preview config still includes Family Controls env.
3. Trigger iOS preview build and capture build URL.

## Done Criteria

- iOS version/build are incremented in Expo + native files.
- EAS preview build starts successfully with updated code.
- User gets the new build URL.

## Progress

- 2026-02-13: Created progress log and started version/build bump + rebuild flow.
- 2026-02-13: Added explicit iOS Insights permissions entry in Profile dev menu and fixed Health sync flow to request Health authorization before syncing.
- 2026-02-13: Bumped app/native iOS versions to `1.0.14` / build `22` and started a new preview iOS EAS build.

## Verification

- `pnpm eas config --platform ios --profile preview` -> resolved with `ENABLE_FAMILY_CONTROLS=1`.
- `rg` checks confirmed:
  - `app.config.js` has `version: '1.0.14'`, `buildNumber: '22'`, `runtimeVersion: '1.0.14'`
  - `ios/mobile/Info.plist` has `CFBundleShortVersionString=1.0.14`, `CFBundleVersion=22`
  - `ios/mobile.xcodeproj/project.pbxproj` has `CURRENT_PROJECT_VERSION = 22` in Debug/Release
- `pnpm eas build --platform ios --profile preview --non-interactive` started successfully and uploaded.

## Outcomes

- New build initiated: `https://expo.dev/accounts/colezer8/projects/mobile/builds/509c4249-23cb-4a0b-bc27-8c9a2865ca16`
- Build includes permission-flow fix in `apps/mobile/src/app/profile.tsx` and version/build bump.

## Follow-ups

- Confirm on-device that Health + Screen Time permission prompts appear from the new in-app entrypoint.
