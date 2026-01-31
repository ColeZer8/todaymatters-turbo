# Android Notification Permission + Settings Deep Link

## Expo IntentLauncher (notification settings)

- Docs: https://docs.expo.dev/versions/latest/sdk/intent-launcher/
- Use `android.settings.APP_NOTIFICATION_SETTINGS` with
  `android.provider.extra.APP_PACKAGE` to open the app's notification settings.

## Expo Notifications (Android channels)

- Docs: https://docs.expo.dev/versions/latest/sdk/notifications/
- Use `setNotificationChannelAsync` to create an Android notification channel so
  the OS exposes notification settings for the app.
