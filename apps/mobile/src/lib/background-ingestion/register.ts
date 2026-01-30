import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import { ACTUAL_INGESTION_BACKGROUND_TASK_NAME } from "./task-names";

let didRegister = false;

export async function registerActualIngestionBackgroundTaskAsync(): Promise<void> {
  if (didRegister) return;
  didRegister = true;

  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  // Expo Go is not a supported target for background task behavior; avoid registering.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  const hasTaskManager = !!requireOptionalNativeModule("ExpoTaskManager");
  const hasBackgroundFetch = !!requireOptionalNativeModule("ExpoBackgroundFetch");
  if (!hasTaskManager || !hasBackgroundFetch) return;

  // Side-effect import that defines the task at module scope.
  await import("./actual-ingestion-task");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BackgroundFetch =
    require("expo-background-fetch") as typeof import("expo-background-fetch");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager =
    require("expo-task-manager") as typeof import("expo-task-manager");

  const status = await BackgroundFetch.getStatusAsync();
  if (status !== BackgroundFetch.BackgroundFetchStatus.Available) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(
    ACTUAL_INGESTION_BACKGROUND_TASK_NAME,
  );
  if (isRegistered) return;

  await BackgroundFetch.registerTaskAsync(
    ACTUAL_INGESTION_BACKGROUND_TASK_NAME,
    {
      minimumInterval: 60 * 30, // 30 minutes (best-effort)
      stopOnTerminate: false,
      startOnBoot: true,
    },
  );
}
