import AsyncStorage from "@react-native-async-storage/async-storage";

export const ANDROID_LOCATION_TASK_METADATA_KEYS = {
  lastTaskFiredAt: "tm:androidLocation:lastTaskFiredAt",
  lastTaskQueuedCount: "tm:androidLocation:lastTaskQueuedCount",
  lastTaskError: "tm:androidLocation:lastTaskError",
};

export interface AndroidLocationTaskMetadata {
  lastTaskFiredAt: string | null;
  lastTaskQueuedCount: number | null;
  lastTaskError: string | null;
}

export async function getAndroidLocationTaskMetadata(): Promise<AndroidLocationTaskMetadata> {
  const [lastTaskFiredAt, lastTaskQueuedCount, lastTaskError] =
    await Promise.all([
      AsyncStorage.getItem(ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskFiredAt),
      AsyncStorage.getItem(
        ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskQueuedCount,
      ),
      AsyncStorage.getItem(ANDROID_LOCATION_TASK_METADATA_KEYS.lastTaskError),
    ]);

  const parsedQueuedCount = lastTaskQueuedCount
    ? Number.parseInt(lastTaskQueuedCount, 10)
    : null;

  return {
    lastTaskFiredAt: lastTaskFiredAt ?? null,
    lastTaskQueuedCount: Number.isFinite(parsedQueuedCount)
      ? parsedQueuedCount
      : null,
    lastTaskError: lastTaskError ?? null,
  };
}
