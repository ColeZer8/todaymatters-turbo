# Fix iOS location permission prompt during onboarding

- Status: In Progress
- Owner: Cole
- Started: 2026-01-14
- Completed: -

## Objective

Ensure the iOS system Location permission prompt (When In Use / Always) appears from the onboarding permissions screen, and provide a reliable fallback (Open Settings) when iOS cannot re-prompt or the dev client is missing the native module.

## Plan

1. Identify the onboarding permissions screen and current location permission request flow.
2. Improve location permission request helpers to surface “canAskAgain” and missing-native-module states.
3. Update the permissions UI to trigger the system prompt when possible, otherwise deep-link to Settings and/or instruct to rebuild dev client.

## Done Criteria

- iOS: toggling Location on shows the iOS system permission prompt when permission is undetermined.
- iOS: if permission was previously denied (no re-prompt), user is offered an “Open Settings” action.
- iOS: if the dev client build is missing `ExpoLocation`, UI clearly instructs rebuilding the iOS dev client.

## Progress

- 2026-01-14: Started investigation. Found onboarding permissions screen calls `requestIosLocationPermissionsAsync()` and shows an Alert when not granted.

## Verification

- `pnpm check-types -- --filter=mobile`
- `pnpm lint -- --filter=mobile`

## Outcomes

- (In progress)

## Follow-ups

- Confirm whether current installed iOS dev client was built before `expo-location` and Info.plist keys were added; if so, rebuild is required.
