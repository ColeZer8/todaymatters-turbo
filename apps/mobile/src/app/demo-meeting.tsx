import { DemoMeetingReminder } from '@/components/organisms';
import { useUserFirstName } from '@/hooks/use-user-first-name';

/**
 * Demo Meeting Reminder Screen
 * 
 * Shows the meeting interruption/reminder flow for demos.
 * Only accessible in demo mode.
 */
export default function DemoMeetingScreen() {
  const userFirstName = useUserFirstName();
  return <DemoMeetingReminder userName={userFirstName} />;
}






