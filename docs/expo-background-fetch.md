# Expo Background Fetch

## Purpose

Use `expo-background-fetch` with `expo-task-manager` to run periodic ingestion work in the background when the app is not active.

## References

- Expo Background Fetch: https://docs.expo.dev/versions/v52.0.0/sdk/background-fetch/
- Expo Task Manager: https://docs.expo.dev/versions/v52.0.0/sdk/task-manager/

## Key Notes

- iOS requires `UIBackgroundModes` to include `fetch`.
- Background fetch is best-effort and not guaranteed on a strict cadence.
- Expo Go does not support background fetch on iOS; use a development build.
