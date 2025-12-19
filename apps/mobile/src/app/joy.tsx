import { useEffect, useState, useMemo, useCallback } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { TagSelectionTemplate, CategoryOption } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useOnboardingSync } from '@/lib/supabase/hooks';

const JOY_OPTIONS: CategoryOption[] = [
  {
    category: 'Creative & Arts',
    emoji: '🎨',
    options: [
      'Reading',
      'Writing',
      'Art',
      'Drawing',
      'Painting',
      'Photography',
      'Music',
      'Singing',
      'Dance',
      'Theater',
      'Poetry',
      'Crafting',
      'Design',
      'Pottery',
      'Sculpting',
    ],
  },
  {
    category: 'Physical & Sports',
    emoji: '💪',
    options: [
      'Exercise',
      'Running',
      'Yoga',
      'Swimming',
      'Cycling',
      'Weightlifting',
      'Team Sports',
      'Martial Arts',
      'Rock Climbing',
      'Tennis',
      'Basketball',
      'Soccer',
      'Golf',
      'Surfing',
      'Skiing',
    ],
  },
  {
    category: 'Nature & Outdoors',
    emoji: '🌲',
    options: [
      'Outdoors',
      'Hiking',
      'Camping',
      'Gardening',
      'Bird Watching',
      'Stargazing',
      'Beach',
      'Mountains',
      'Fishing',
      'Nature Walks',
      'Forest Bathing',
      'Kayaking',
      'Sailing',
    ],
  },
  {
    category: 'Social & Relationships',
    emoji: '👥',
    options: [
      'Friends & Family',
      'Socializing',
      'Volunteering',
      'Community Events',
      'Networking',
      'Dating',
      'Pets',
      'Children',
      'Game Nights',
      'Book Clubs',
      'Support Groups',
    ],
  },
  {
    category: 'Learning & Growth',
    emoji: '📚',
    options: [
      'Learning',
      'Podcasts',
      'Courses',
      'Languages',
      'Research',
      'Philosophy',
      'History',
      'Science',
      'Online Learning',
      'Workshops',
      'Conferences',
    ],
  },
  {
    category: 'Entertainment & Media',
    emoji: '🎬',
    options: [
      'Gaming',
      'Movies',
      'TV Shows',
      'Streaming',
      'Books',
      'Comics',
      'Anime',
      'Concerts',
      'Festivals',
      'Live Music',
      'Stand-up Comedy',
    ],
  },
  {
    category: 'Food & Cooking',
    emoji: '🍳',
    options: [
      'Cooking',
      'Baking',
      'Trying New Restaurants',
      'Food Tours',
      'Wine Tasting',
      'Coffee',
      'Tea',
      'Cocktails',
      'Meal Prep',
      'Food Photography',
    ],
  },
  {
    category: 'Travel & Adventure',
    emoji: '✈️',
    options: [
      'Travel',
      'Exploring',
      'Road Trips',
      'International Travel',
      'Local Adventures',
      'Sightseeing',
      'Backpacking',
      'City Breaks',
      'Cultural Immersion',
      'Adventure Sports',
    ],
  },
  {
    category: 'Tech & Digital',
    emoji: '💻',
    options: [
      'Tech',
      'Coding',
      'Building Apps',
      'Video Games',
      'VR',
      'Streaming',
      'Social Media',
      'Photography',
      'Video Editing',
      '3D Printing',
      'Robotics',
    ],
  },
  {
    category: 'Relaxation & Wellness',
    emoji: '🧘',
    options: [
      'Meditation',
      'Spa',
      'Massage',
      'Self-Care',
      'Hot Baths',
      'Sleep',
      'Rest',
      'Mindfulness',
      'Breathing Exercises',
      'Aromatherapy',
      'Sauna',
    ],
  },
];

export default function JoyScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const hasHydrated = useOnboardingStore((state) => state._hasHydrated);
  const selected = useOnboardingStore((state) => state.joySelections);
  const customOptions = useOnboardingStore((state) => state.joyCustomOptions);
  const toggleSelection = useOnboardingStore((state) => state.toggleJoySelection);
  const addCustomOption = useOnboardingStore((state) => state.addJoyCustomOption);

  // Supabase sync
  const { saveJoySelections, saveJoyCustomOptions } = useOnboardingSync({ autoLoad: false, autoSave: false });

  const [searchValue, setSearchValue] = useState('');

  // Save to Supabase when selections change
  useEffect(() => {
    if (hasHydrated && isAuthenticated && selected.length >= 0) {
      // Debounce saves - only save after user stops selecting for 1 second
      const timeoutId = setTimeout(() => {
        saveJoySelections(selected);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [selected, hasHydrated, isAuthenticated, saveJoySelections]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    const timeoutId = setTimeout(() => {
      saveJoyCustomOptions(customOptions);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [customOptions, hasHydrated, isAuthenticated, saveJoyCustomOptions]);

  const options = useMemo(() => {
    if (customOptions.length > 0) {
      return [
        ...JOY_OPTIONS,
        { category: 'Custom', emoji: '✨', options: customOptions },
      ];
    }
    return JOY_OPTIONS;
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
      ...JOY_OPTIONS.flatMap((cat) => cat.options),
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
      step={ONBOARDING_STEPS.joy}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      title="What brings you joy?"
      subtitle="Select things that energize you."
      placeholder="Search or add..."
      options={options}
      selectedOptions={selected}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onToggleOption={toggleSelection}
      onAddOption={handleAddOption}
      onContinue={() => router.replace('/drains')}
      onBack={() => router.replace('/daily-rhythm')}
      tone="primary"
    />
  );
}
