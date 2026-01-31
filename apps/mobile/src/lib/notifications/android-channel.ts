import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const LOCATION_CHANNEL_ID = "tm-location";

export function getAndroidLocationChannelId(): string {
  return LOCATION_CHANNEL_ID;
}

export async function ensureAndroidLocationChannelAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(LOCATION_CHANNEL_ID, {
    name: "Background tracking",
    description:
      "Keeps background location updates available for day comparisons.",
    // DEFAULT importance keeps the notification persistent without being intrusive.
    // LOW can cause Android to deprioritize and kill the foreground service.
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
    enableLights: false,
    showBadge: false,
  });
}
