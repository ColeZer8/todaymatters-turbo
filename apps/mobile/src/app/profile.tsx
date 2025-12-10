import { useState } from 'react';
import { Bell, Briefcase, CreditCard, LogOut, LucideIcon, Play, Settings, Target } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ProfileTemplate } from '@/components/templates';
import { useDemoStore } from '@/stores';

const CORE_VALUES = ['Family', 'Integrity', 'Creativity'];

type AccentTone = 'blue' | 'purple';

type ProfileItem = { id: string; label: string; icon: LucideIcon; accent?: AccentTone };

const GOALS: ProfileItem[] = [
  { id: 'goal-1', label: 'Launch MVP', icon: Target, accent: 'blue' },
  { id: 'goal-2', label: 'Run 5k', icon: Target, accent: 'blue' },
];

const INITIATIVES: ProfileItem[] = [
  { id: 'initiative-1', label: 'Q4 Strategy', icon: Briefcase, accent: 'purple' },
  { id: 'initiative-2', label: 'Team Hiring', icon: Briefcase, accent: 'purple' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const setDemoActive = useDemoStore((state) => state.setActive);

  const handleStartDemo = () => {
    setDemoActive(true);
    router.push('/home');
  };

  // Build menu items - include Demo Mode in development builds
  const menuItems = [
    { id: 'account-settings', label: 'Account Settings', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    // Demo Mode - only visible in development
    ...(__DEV__
      ? [
          {
            id: 'demo-mode',
            label: '🎬 Demo Mode',
            icon: Play,
            onPress: handleStartDemo,
          },
        ]
      : []),
    { id: 'logout', label: 'Log Out', icon: LogOut },
  ];
  const [isEditing, setIsEditing] = useState(false);
  const [coreValues, setCoreValues] = useState<string[]>(CORE_VALUES);
  const [newValueText, setNewValueText] = useState('');
  const [goals, setGoals] = useState<ProfileItem[]>(GOALS);
  const [newGoalText, setNewGoalText] = useState('');
  const [initiatives, setInitiatives] = useState<ProfileItem[]>(INITIATIVES);
  const [newInitiativeText, setNewInitiativeText] = useState('');

  const handleAddValue = () => {
    const next = newValueText.trim();
    if (!next) return;
    setCoreValues((prev) => [...prev, next]);
    setNewValueText('');
  };

  const handleRemoveValue = (value: string) => {
    setCoreValues((prev) => prev.filter((item) => item !== value));
  };

  const handleAddGoal = () => {
    const next = newGoalText.trim();
    if (!next) return;
    setGoals((prev) => [
      ...prev,
      { id: `goal-${Date.now()}`, label: next, icon: Target, accent: 'blue' },
    ]);
    setNewGoalText('');
  };

  const handleRemoveGoal = (id: string) => {
    setGoals((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddInitiative = () => {
    const next = newInitiativeText.trim();
    if (!next) return;
    setInitiatives((prev) => [
      ...prev,
      { id: `initiative-${Date.now()}`, label: next, icon: Briefcase, accent: 'purple' },
    ]);
    setNewInitiativeText('');
  };

  const handleRemoveInitiative = (id: string) => {
    setInitiatives((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <ProfileTemplate
      name="Paul"
      role="Professional"
      badgeLabel="Pro Member"
      coreValues={coreValues}
      goals={goals}
      initiatives={initiatives}
      menuItems={menuItems}
      isEditing={isEditing}
      onEditPress={() => setIsEditing(true)}
      onDonePress={() => setIsEditing(false)}
      newValueText={newValueText}
      onChangeNewValue={setNewValueText}
      onAddValue={handleAddValue}
      onRemoveValue={handleRemoveValue}
      newGoalText={newGoalText}
      onChangeNewGoal={setNewGoalText}
      onAddGoal={handleAddGoal}
      onRemoveGoal={handleRemoveGoal}
      newInitiativeText={newInitiativeText}
      onChangeNewInitiative={setNewInitiativeText}
      onAddInitiative={handleAddInitiative}
      onRemoveInitiative={handleRemoveInitiative}
    />
  );
}
