import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { TagSelectionTemplate, CategoryOption } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

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

  const [selected, setSelected] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [options, setOptions] = useState<CategoryOption[]>(DRAIN_OPTIONS);

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  useEffect(() => {
    // Update options to include custom category if there are custom options
    if (customOptions.length > 0) {
      setOptions([
        ...DRAIN_OPTIONS,
        {
          category: 'Custom',
          emoji: '✨',
          options: customOptions,
        },
      ]);
    } else {
      setOptions(DRAIN_OPTIONS);
    }
  }, [customOptions]);

  const toggleSelection = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const handleAddOption = (value: string) => {
    // Check if it already exists (case-insensitive) across all categories
    const allExistingOptions = [
      ...DRAIN_OPTIONS.flatMap((cat) => cat.options),
      ...customOptions,
    ];
    const exists = allExistingOptions.some(
      (opt) => opt.toLowerCase() === value.toLowerCase(),
    );
    
    if (!exists) {
      setCustomOptions((prev) => [...prev, value]);
      // Automatically select the newly added option
      setSelected((prev) => [...prev, value]);
      setSearchValue('');
    }
  };

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
