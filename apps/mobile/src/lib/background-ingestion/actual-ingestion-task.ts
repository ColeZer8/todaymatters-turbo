import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { supabase } from "@/lib/supabase/client";
import {
  getPreviousIngestionWindow,
  processActualIngestionWindow,
} from "@/lib/supabase/hooks/use-actual-ingestion";
import { ACTUAL_INGESTION_BACKGROUND_TASK_NAME } from "./task-names";

// IMPORTANT: Task definitions must live at module scope (per Expo docs).
if (
  (Platform.OS === "ios" || Platform.OS === "android") &&
  requireOptionalNativeModule("ExpoTaskManager") &&
  requireOptionalNativeModule("ExpoBackgroundFetch")
) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager =
    require("expo-task-manager") as typeof import("expo-task-manager");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BackgroundFetch =
    require("expo-background-fetch") as typeof import("expo-background-fetch");

  TaskManager.defineTask(
    ACTUAL_INGESTION_BACKGROUND_TASK_NAME,
    async (): Promise<number> => {
      try {
        const sessionResult = await supabase.auth.getSession();
        const userId = sessionResult.data.session?.user?.id ?? null;
        if (!userId) {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const window = getPreviousIngestionWindow();
        const result = await processActualIngestionWindow({
          userId,
          windowStart: window.start,
          windowEnd: window.end,
          logStats: __DEV__,
        });

        if (result.skipped) {
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        if (__DEV__) {
          console.warn(
            "[ActualIngestion] Background fetch failed:",
            error,
          );
        }
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    },
  );
}
