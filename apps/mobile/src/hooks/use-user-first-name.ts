import { useMemo } from "react";
import { deriveFullNameFromEmail, getFirstName } from "@/lib/user-name";
import { useAuthStore, useOnboardingStore } from "@/stores";

/**
 * Matches the Home screen greeting logic:
 * - Prefer onboarding/profile full name when present
 * - Fallback to deriving from email
 */
export function useUserFirstName(): string {
  const user = useAuthStore((s) => s.user);
  const fullName = useOnboardingStore((s) => s.fullName);

  return useMemo(() => {
    const derivedFromEmail = deriveFullNameFromEmail(user?.email);
    return (
      getFirstName(fullName) ??
      getFirstName(derivedFromEmail) ??
      "there"
    ).trim();
  }, [fullName, user?.email]);
}
