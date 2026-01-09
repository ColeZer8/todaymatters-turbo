import { DemoPrayerAction } from '@/components/organisms';
import { useUserFirstName } from '@/hooks/use-user-first-name';

export default function DemoPrayerScreen() {
  const userFirstName = useUserFirstName();
  return <DemoPrayerAction userName={userFirstName} />;
}






