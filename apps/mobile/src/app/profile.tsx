import { useRouter } from 'expo-router';
import { Bell, Briefcase, CreditCard, LogOut, Settings, Target } from 'lucide-react-native';
import { ProfileTemplate } from '@/components/templates';

const CORE_VALUES = ['Family', 'Integrity', 'Creativity'];

const GOALS = [
  { id: 'goal-1', label: 'Launch MVP', icon: Target, accent: 'blue' as const },
  { id: 'goal-2', label: 'Run 5k', icon: Target, accent: 'blue' as const },
];

const INITIATIVES = [
  { id: 'initiative-1', label: 'Q4 Strategy', icon: Briefcase, accent: 'purple' as const },
  { id: 'initiative-2', label: 'Team Hiring', icon: Briefcase, accent: 'purple' as const },
];

const MENU_ITEMS = [
  { id: 'account-settings', label: 'Account Settings', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'logout', label: 'Log Out', icon: LogOut },
];

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <ProfileTemplate
      name="Paul"
      role="Professional"
      badgeLabel="Pro Member"
      coreValues={CORE_VALUES}
      goals={GOALS}
      initiatives={INITIATIVES}
      menuItems={MENU_ITEMS}
      onBack={() => router.back()}
      onEditPress={() => {}}
    />
  );
}
