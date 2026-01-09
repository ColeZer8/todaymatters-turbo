import { DemoTrafficAccident } from '@/components/organisms';
import { useUserFirstName } from '@/hooks/use-user-first-name';

/**
 * Demo Traffic Accident Screen
 *
 * Shows accident alert with alternate route notification for demos.
 * Only accessible in demo mode.
 */
export default function DemoTrafficAccidentScreen() {
  const userFirstName = useUserFirstName();
  return <DemoTrafficAccident userName={userFirstName} />;
}






