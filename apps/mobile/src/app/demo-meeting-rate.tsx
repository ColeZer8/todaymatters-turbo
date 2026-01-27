import { DemoMeetingRate } from "@/components/organisms";
import { useUserFirstName } from "@/hooks/use-user-first-name";

/**
 * Demo Meeting Rate Screen
 *
 * Shows meeting reflection rating screen for demos.
 * Only accessible in demo mode.
 */
export default function DemoMeetingRateScreen() {
  const userFirstName = useUserFirstName();
  return <DemoMeetingRate userName={userFirstName} />;
}
