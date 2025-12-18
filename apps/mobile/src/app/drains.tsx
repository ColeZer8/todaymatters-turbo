import { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { TagSelectionTemplate, CategoryOption } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';

const DRAIN_OPTIONS: CategoryOption[] = [
  {
    category: 'Work & Productivity',
    emoji: '💼',
    options: [
      'Long meetings',
      'Context switching',
      'Interruptions',
      'Deadlines',
      'Overwhelming workload',
      'Micromanagement',
      'Unclear expectations',
      'Unnecessary emails',
      'Back-to-back meetings',
      'Commuting to work',
      'Overtime',
      'Work stress',
    ],
  },
  {
    category: 'Social & Communication',
    emoji: '😓',
    options: [
      'Small talk',
      'Social obligations',
      'Conflict',
      'Drama',
      'Gossip',
      'Awkward conversations',
      'Large crowds',
      'Networking events',
      'Forced socializing',
      'Toxic relationships',
      'Negative people',
      'Social media pressure',
    ],
  },
  {
    category: 'Time & Scheduling',
    emoji: '⏰',
    options: [
      'Traffic',
      'Waiting',
      'Being late',
      'Rushing',
      'Time pressure',
      'Scheduling conflicts',
      'No downtime',
      'Overcommitment',
      'Last-minute changes',
      'Time zones',
      'Running errands',
      'Time wasted',
    ],
  },
  {
    category: 'Environment & Physical',
    emoji: '🌡️',
    options: [
      'Cold weather',
      'Hot weather',
      'Loud noises',
      'Bright lights',
      'Clutter',
      'Messy spaces',
      'Uncomfortable temperatures',
      'Poor air quality',
      'Crowded spaces',
      'Bad smells',
      'Noise pollution',
      'Uncomfortable seating',
    ],
  },
  {
    category: 'Technology & Digital',
    emoji: '💻',
    options: [
      'Technology issues',
      'Slow internet',
      'Device problems',
      'Spam emails',
      'Notifications',
      'Social media overload',
      'Screen time',
      'Password resets',
      'Software updates',
      'Digital distractions',
      'Tech support',
      'Data loss',
    ],
  },
  {
    category: 'Health & Wellbeing',
    emoji: '😴',
    options: [
      'Lack of sleep',
      'Early mornings',
      'Late nights',
      'Exhaustion',
      'Stress',
      'Anxiety',
      'Physical discomfort',
      'Hunger',
      'Thirst',
      'Illness',
      'Chronic pain',
      'Fatigue',
    ],
  },
  {
    category: 'Financial & Practical',
    emoji: '💰',
    options: [
      'Financial stress',
      'Bills',
      'Unexpected expenses',
      'Budgeting',
      'Shopping',
      'Errands',
      'Paperwork',
      'Bureaucracy',
      'Waiting in lines',
      'Administrative tasks',
      'Taxes',
      'Insurance',
    ],
  },
  {
    category: 'Emotional & Mental',
    emoji: '🧠',
    options: [
      'Negative thoughts',
      'Self-doubt',
      'Perfectionism',
      'Comparison',
      'Regret',
      'Worry',
      'Overthinking',
      'Decision fatigue',
      'Information overload',
      'Mental exhaustion',
      'Imposter syndrome',
      'Procrastination',
    ],
  },
];

export default function DrainsScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const selected = useOnboardingStore((state) => state.drainSelections);
  const customOptions = useOnboardingStore((state) => state.drainCustomOptions);
  const toggleSelection = useOnboardingStore((state) => state.toggleDrainSelection);
  const addCustomOption = useOnboardingStore((state) => state.addDrainCustomOption);

  // Supabase sync
  const { saveDrainSelections } = useOnboardingSync({ autoLoad: false, autoSave: false });

  const [searchValue, setSearchValue] = useState('');

  // Save to Supabase when selections change
  useEffect(() => {
    if (hasHydrated && isAuthenticated && selected.length >= 0) {
      // Debounce saves - only save after user stops selecting for 1 second
      const timeoutId = setTimeout(() => {
        saveDrainSelections(selected);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [selected, hasHydrated, isAuthenticated, saveDrainSelections]);

  const options = useMemo(() => {
    if (customOptions.length > 0) {
      return [
        ...DRAIN_OPTIONS,
        { category: 'Custom', emoji: '✨', options: customOptions },
      ];
    }
    return DRAIN_OPTIONS;
  }, [customOptions]);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  const handleAddOption = (value: string) => {
    const allExistingOptions = [
      ...DRAIN_OPTIONS.flatMap((cat) => cat.options),
      ...customOptions,
    ];
    const exists = allExistingOptions.some(
      (opt) => opt.toLowerCase() === value.toLowerCase(),
    );
    if (!exists) {
      addCustomOption(value);
      setSearchValue('');
    }
  };

  if (!isNavigationReady || !hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f5f9ff]">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <TagSelectionTemplate
      step={ONBOARDING_STEPS.drains}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title="What drains you?"
      subtitle="We'll help you minimize these."
      placeholder="Search or add..."
      options={options}
      selectedOptions={selected}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onToggleOption={toggleSelection}
      onAddOption={handleAddOption}
      onContinue={() => router.replace('/your-why')}
      onBack={() => router.replace('/joy')}
      tone="danger"
    />
  );
}
