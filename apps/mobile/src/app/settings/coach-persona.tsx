import { useRouter } from 'expo-router';
import { BriefcaseBusiness, ShieldCheck, Sparkles } from 'lucide-react-native';
import { CoachPersonaTemplate } from '@/components/templates';
import { useOnboardingStore } from '@/stores/onboarding-store';

const COACH_PERSONA_OPTIONS = [
  {
    id: 'strategist',
    title: 'The Strategist',
    description: 'Logical, data-driven, and efficient.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'cheerleader',
    title: 'The Cheerleader',
    description: 'Warm, encouraging, and positive.',
    icon: Sparkles,
  },
  {
    id: 'sergeant',
    title: 'The Sergeant',
    description: 'Direct, no-nonsense accountability.',
    icon: ShieldCheck,
  },
] as const;

export default function SettingsCoachPersonaScreen() {
  const router = useRouter();

  const selected = useOnboardingStore((state) => state.coachPersona);
  const setSelected = useOnboardingStore((state) => state.setCoachPersona);

  return (
    <CoachPersonaTemplate
      mode="settings"
      options={COACH_PERSONA_OPTIONS}
      selectedId={selected}
      onSelect={setSelected}
      onBack={() => router.back()}
    />
  );
}






