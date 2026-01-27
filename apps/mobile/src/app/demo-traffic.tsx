import { DemoTrafficAlert } from "@/components/organisms";
import { useUserFirstName } from "@/hooks/use-user-first-name";

/**
 * Demo Traffic Alert Screen
 *
 * Shows the proactive traffic/departure reminder for demos.
 * Only accessible in demo mode.
 */
export default function DemoTrafficScreen() {
  const userFirstName = useUserFirstName();
  return <DemoTrafficAlert userName={userFirstName} />;
}
