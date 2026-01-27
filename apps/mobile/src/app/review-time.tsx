import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ReviewTimeTemplate } from "@/components/templates";

export default function ReviewTimeScreen() {
  const params = useLocalSearchParams<{
    focusId?: string;
    startMinutes?: string;
    duration?: string;
    title?: string;
    description?: string;
  }>();

  const focusBlock = useMemo(() => {
    if (!params.startMinutes || !params.duration) return undefined;
    const startMinutes = Number(params.startMinutes);
    const duration = Number(params.duration);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(duration))
      return undefined;
    return {
      id:
        params.focusId ??
        `focus_${Math.round(startMinutes)}_${Math.round(duration)}`,
      startMinutes,
      duration,
      title: params.title,
      description: params.description,
    };
  }, [
    params.description,
    params.duration,
    params.focusId,
    params.startMinutes,
    params.title,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReviewTimeTemplate focusBlock={focusBlock} />
    </>
  );
}
