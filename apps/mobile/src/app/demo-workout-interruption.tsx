import { useMemo } from "react";
import { DemoWorkoutInterruption } from "@/components/organisms";
import { deriveFullNameFromEmail, getFirstName } from "@/lib/user-name";
import { useAuthStore, useOnboardingStore } from "@/stores";

/**
 * Demo Workout Interruption Screen
 *
 * Shows the "no time for social media" interruption alert for demos.
 * Only accessible in demo mode.
 */
export default function DemoWorkoutInterruptionScreen() {
  const user = useAuthStore((s) => s.user);
  const fullName = useOnboardingStore((s) => s.fullName);

  const userFirstName = useMemo(() => {
    const derivedFromEmail = deriveFullNameFromEmail(user?.email);
    return (
      getFirstName(fullName) ??
      getFirstName(derivedFromEmail) ??
      "there"
    ).trim();
  }, [fullName, user?.email]);

  return <DemoWorkoutInterruption userName={userFirstName} />;
}
