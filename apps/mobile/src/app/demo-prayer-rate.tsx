import { DemoPrayerRate } from '@/components/organisms';
import { useUserFirstName } from '@/hooks/use-user-first-name';

/**
 * Demo Prayer Rate Screen
 * 
 * Shows prayer/spiritual reflection rating screen for demos.
 * Only accessible in demo mode.
 */
export default function DemoPrayerRateScreen() {
  const userFirstName = useUserFirstName();
  return <DemoPrayerRate userName={userFirstName} />;
}






