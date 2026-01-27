import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { PersonalizationTemplate } from "@/components/templates/PersonalizationTemplate";
import {
  useAppCategoryOverridesStore,
  useAuthStore,
  useUserPreferencesStore,
} from "@/stores";
import {
  DEFAULT_USER_PREFERENCES,
  type GapFillingPreference,
  type UserDataPreferences,
} from "@/stores/user-preferences-store";
import {
  fetchUserDataPreferences,
  upsertUserDataPreferences,
} from "@/lib/supabase/services/user-preferences";

export default function PersonalizationScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const preferences = useUserPreferencesStore((s) => s.preferences);
  const setPreferences = useUserPreferencesStore((s) => s.setPreferences);
  const overridesCount = useAppCategoryOverridesStore(
    (s) => Object.keys(s.overrides).length,
  );
  const [draft, setDraft] = useState<UserDataPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!userId) {
      setPreferences(DEFAULT_USER_PREFERENCES);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await fetchUserDataPreferences(userId);
      if (cancelled) return;
      setPreferences(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [setPreferences, userId]);

  const onSave = useCallback(async () => {
    if (!userId) {
      Alert.alert("Sign in required", "Sign in to save preferences.");
      return;
    }
    setIsSaving(true);
    try {
      const saved = await upsertUserDataPreferences({
        userId,
        preferences: draft,
      });
      setPreferences(saved);
      Alert.alert("Saved", "Your personalization settings were updated.");
    } catch (error) {
      if (__DEV__) {
        console.warn("[Personalization] Save failed:", error);
      }
      Alert.alert("Save failed", "Please try again in a moment.");
    } finally {
      setIsSaving(false);
    }
  }, [draft, setPreferences, userId]);

  const confidenceThreshold = useMemo(
    () => Math.round(draft.confidenceThreshold * 100) / 100,
    [draft],
  );

  return (
    <>
      <Stack.Screen options={{ title: "Personalization" }} />
      <PersonalizationTemplate
        gapFillingPreference={draft.gapFillingPreference}
        confidenceThreshold={confidenceThreshold}
        autoSuggestEvents={draft.autoSuggestEvents}
        verificationAlerts={draft.verificationAlerts}
        realTimeUpdates={draft.realTimeUpdates}
        verificationStrictness={draft.verificationStrictness}
        isSaving={isSaving}
        appOverridesCount={overridesCount}
        onSelectGapFilling={(value: GapFillingPreference) =>
          setDraft((prev) => ({ ...prev, gapFillingPreference: value }))
        }
        onSelectConfidence={(value: number) =>
          setDraft((prev) => ({ ...prev, confidenceThreshold: value }))
        }
        onToggleAutoSuggest={(value) =>
          setDraft((prev) => ({ ...prev, autoSuggestEvents: value }))
        }
        onToggleVerificationAlerts={(value) =>
          setDraft((prev) => ({ ...prev, verificationAlerts: value }))
        }
        onToggleRealTimeUpdates={(value) =>
          setDraft((prev) => ({ ...prev, realTimeUpdates: value }))
        }
        onSelectVerificationStrictness={(value) =>
          setDraft((prev) => ({ ...prev, verificationStrictness: value }))
        }
        onOpenAppOverrides={() => router.push("/app-category-overrides")}
        onSave={onSave}
      />
    </>
  );
}
