import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Briefcase,
  Calendar,
  CreditCard,
  ListChecks,
  LogOut,
  LucideIcon,
  MessageCircle,
  MoonStar,
  Play,
  Settings,
  Target,
} from 'lucide-react-native';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ProfileTemplate } from '@/components/templates';
import { DatePickerPopup } from '@/components/molecules';
import { useDemoStore, useAuthStore, useOnboardingStore, useReviewTimeStore } from '@/stores';
import {
  addProfileValue,
  fetchProfile,
  fetchProfileValues,
  removeProfileValue,
  saveProfileValues,
  updateBirthday,
  updateFullName,
  syncAndroidUsageSummary,
  syncIosScreenTimeSummary,
  syncIosHealthSummary,
} from '@/lib/supabase/services';
import { deriveFullNameFromEmail } from '@/lib/user-name';
import {
  getCachedScreenTimeSummarySafeAsync,
  getScreenTimeAuthorizationStatusSafeAsync,
  presentScreenTimeReportSafeAsync,
  requestScreenTimeAuthorizationSafeAsync,
  getHealthSummarySafeAsync,
  getTodayActivityRingsSummarySafeAsync,
  getLatestWorkoutSummarySafeAsync,
} from '@/lib/ios-insights';
import {
  getAndroidInsightsSupportStatus,
  getUsageAccessAuthorizationStatusSafeAsync,
  getUsageSummarySafeAsync,
  openUsageAccessSettingsSafeAsync,
} from '@/lib/android-insights';
import { flushPendingLocationSamplesToSupabaseAsync } from '@/lib/ios-location';
import { flushPendingAndroidLocationSamplesToSupabaseAsync } from '@/lib/android-location';
import { requestIosLocationPermissionsAsync } from '@/lib/ios-location';
import { requestAndroidLocationPermissionsAsync } from '@/lib/android-location';

// Start with empty values - will load from Supabase if authenticated
const CORE_VALUES: string[] = [];

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
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fullName = useOnboardingStore((s) => s.fullName);
  const setFullName = useOnboardingStore((s) => s.setFullName);
  const requestAutoAssignAll = useReviewTimeStore((s) => s.requestAutoAssignAll);

  const handleStartDemo = () => {
    setDemoActive(true);
    router.push('/home');
  };

  const handleDevReviewTime = () => {
    router.push('/review-time');
  };

  const handleDevSyncScreenTime = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (Platform.OS === 'ios') {
        const status = await getScreenTimeAuthorizationStatusSafeAsync();
        if (status !== 'approved') {
          const next = await requestScreenTimeAuthorizationSafeAsync();
          if (next !== 'approved') {
            return;
          }
        }
        await presentScreenTimeReportSafeAsync('today');
        const summary = await getCachedScreenTimeSummarySafeAsync('today');
        if (summary) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
          await syncIosScreenTimeSummary(user.id, summary, timezone);
        }
        router.push('/review-time');
        return;
      }

      if (Platform.OS === 'android') {
        const support = getAndroidInsightsSupportStatus();
        if (support !== 'available') {
          Alert.alert('Screen time', 'Android usage access requires the custom dev client.');
          return;
        }
        const status = await getUsageAccessAuthorizationStatusSafeAsync();
        if (status !== 'authorized') {
          await openUsageAccessSettingsSafeAsync();
          Alert.alert('Screen time', 'Enable Usage Access for TodayMatters, then retry.');
          return;
        }
        const summary = await getUsageSummarySafeAsync('today');
        if (summary) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
          try {
            await syncAndroidUsageSummary(user.id, summary, timezone);
          } catch (error) {
            Alert.alert(
              'Screen Time sync',
              'Usage data is available locally, but Supabase tables are missing. Open the dashboard to view without syncing.'
            );
            router.push('/dev/screen-time');
            return;
          }
        }
        router.push('/review-time');
      }
    } catch (error) {
      Alert.alert('Screen Time sync failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [router, user?.id]);

  const handleDevSyncHealth = useCallback(async () => {
    if (!user?.id) return;
    if (Platform.OS !== 'ios') {
      Alert.alert('Health', 'Health sync is currently iOS-only.');
      return;
    }
    try {
      const [summary, rings, workout] = await Promise.all([
        getHealthSummarySafeAsync('today'),
        getTodayActivityRingsSummarySafeAsync(),
        getLatestWorkoutSummarySafeAsync('today'),
      ]);
      if (summary) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        await syncIosHealthSummary(user.id, summary, timezone, rings, workout);
      }
      Alert.alert('Health sync', 'Health data synced.');
    } catch (error) {
      Alert.alert('Health sync failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [user?.id]);

  const handleDevFlushLocation = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (Platform.OS === 'ios') {
        await flushPendingLocationSamplesToSupabaseAsync(user.id);
      } else if (Platform.OS === 'android') {
        await flushPendingAndroidLocationSamplesToSupabaseAsync(user.id);
      }
      Alert.alert('Location sync', 'Location samples flushed.');
    } catch (error) {
      Alert.alert('Location sync failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [user?.id]);

  const handleDevRequestLocation = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        const result = await requestIosLocationPermissionsAsync();
        Alert.alert(
          'Location permission',
          `Foreground: ${result.foreground}\nBackground: ${result.background}`,
        );
      } else if (Platform.OS === 'android') {
        const result = await requestAndroidLocationPermissionsAsync();
        Alert.alert(
          'Location permission',
          `Foreground: ${result.foreground}\nBackground: ${result.background}`,
        );
      } else {
        Alert.alert('Location permission', 'Unsupported platform.');
      }
    } catch (error) {
      Alert.alert('Location permission failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  const handleDevAutoAssignReview = useCallback(() => {
    requestAutoAssignAll();
    router.push('/review-time');
  }, [requestAutoAssignAll, router]);

  // Personalization settings - edit onboarding preferences
  const personalizationItems = [
    {
      id: 'daily-rhythm',
      label: 'Daily Rhythm',
      icon: MoonStar,
      onPress: () => router.push('/settings/daily-rhythm'),
    },
    {
      id: 'coach-persona',
      label: 'Coach Persona',
      icon: MessageCircle,
      onPress: () => router.push('/settings/coach-persona'),
    },
    {
      id: 'build-routine',
      label: 'Morning Routine',
      icon: ListChecks,
      onPress: () => router.push('/settings/build-routine'),
    },
    {
      id: 'ideal-day',
      label: 'Ideal Day',
      icon: Calendar,
      onPress: () => router.push('/settings/ideal-day'),
    },
  ];

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
          {
            id: 'dev-review-time',
            label: '🧪 Review Time (dev)',
            icon: Calendar,
            onPress: handleDevReviewTime,
          },
          {
            id: 'dev-sync-screen-time',
            label: '🧪 Sync Screen Time (dev)',
            icon: Calendar,
            onPress: handleDevSyncScreenTime,
          },
          {
            id: 'dev-screen-time-dashboard',
            label: '🧪 Screen Time Dashboard (dev)',
            icon: Calendar,
            onPress: () => router.push('/dev/screen-time'),
          },
          {
            id: 'dev-location-dashboard',
            label: '🧪 Location Samples (dev)',
            icon: Calendar,
            onPress: () => router.push('/dev/location'),
          },
          {
            id: 'dev-sync-health',
            label: '🧪 Sync Health (dev)',
            icon: Calendar,
            onPress: handleDevSyncHealth,
          },
          {
            id: 'dev-flush-location',
            label: '🧪 Flush Location (dev)',
            icon: Calendar,
            onPress: handleDevFlushLocation,
          },
          {
            id: 'dev-request-location',
            label: '🧪 Request Location (dev)',
            icon: Calendar,
            onPress: handleDevRequestLocation,
          },
          {
            id: 'dev-auto-assign-review',
            label: '🧪 Auto-Assign Review (AI)',
            icon: Calendar,
            onPress: handleDevAutoAssignReview,
          },
        ]
      : []),
    { id: 'logout', label: 'Log Out', icon: LogOut },
  ];
  const [isEditing, setIsEditing] = useState(false);
  const [draftFullName, setDraftFullName] = useState(fullName);
  const [coreValues, setCoreValues] = useState<string[]>([]);
  const [newValueText, setNewValueText] = useState('');
  const [goals, setGoals] = useState<ProfileItem[]>(GOALS);
  const [newGoalText, setNewGoalText] = useState('');
  const [initiatives, setInitiatives] = useState<ProfileItem[]>(INITIATIVES);
  const [newInitiativeText, setNewInitiativeText] = useState('');
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [hasLoadedValues, setHasLoadedValues] = useState(false);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [isBirthdayPickerVisible, setIsBirthdayPickerVisible] = useState(false);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);

  // Fetch profile values from Supabase on mount (if authenticated)
  useEffect(() => {
    if (!isAuthenticated || !user?.id || hasLoadedValues) {
      if (!isAuthenticated) {
        console.log('🔒 Not authenticated, skipping profile values fetch');
      }
      return;
    }

    const loadValues = async () => {
      console.log('🔄 Loading profile values for user:', user.id, user.email);
      setIsLoadingValues(true);
      try {
        const values = await fetchProfileValues(user.id);
        if (values.length > 0) {
          console.log('✅ Loaded', values.length, 'values from Supabase:', values);
          setCoreValues(values);
        } else {
          console.log('ℹ️ No values found in Supabase, starting with empty list');
          setCoreValues([]);
        }
        setHasLoadedValues(true);
      } catch (error) {
        console.error('❌ Failed to load profile values from Supabase, using local defaults:', error);
        // Fallback to default values - don't break the UI
        setHasLoadedValues(true);
      } finally {
        setIsLoadingValues(false);
      }
    };

    loadValues();
  }, [isAuthenticated, user?.id, hasLoadedValues]);

  // Keep local draft in sync when store changes (e.g. loaded from Supabase elsewhere).
  useEffect(() => {
    setDraftFullName(fullName);
  }, [fullName]);

  // Fetch profile (for birthday) on mount (if authenticated)
  useEffect(() => {
    if (!isAuthenticated || !user?.id || hasLoadedProfile) return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchProfile(user.id);
        if (cancelled) return;
        if (profile?.full_name) {
          setFullName(profile.full_name);
        }
        setBirthday(profile?.birthday ? ymdToDate(profile.birthday) : null);
        setHasLoadedProfile(true);
      } catch (error) {
        console.error('❌ Failed to load profile:', error);
        setHasLoadedProfile(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, hasLoadedProfile]);

  // Save values to Supabase when they change (if authenticated)
  const syncValuesToSupabase = useCallback(
    async (values: string[]) => {
      if (!isAuthenticated || !user?.id) return;

      try {
        await saveProfileValues(user.id, values);
      } catch (error) {
        console.error('Failed to save profile values to Supabase:', error);
        // Don't throw - optimistic update already happened
        // User can retry by editing again
      }
    },
    [isAuthenticated, user?.id]
  );

  const handleAddValue = async () => {
    const next = newValueText.trim();
    if (!next) return;

    // Store previous state for rollback
    const previousValues = coreValues;

    // Optimistic update - update UI immediately
    const newValues = [...coreValues, next];
    setCoreValues(newValues);
    setNewValueText('');

    // Sync to Supabase in background
    if (isAuthenticated && user?.id) {
      try {
        await addProfileValue(user.id, next);
      } catch (error) {
        console.error('Failed to add value to Supabase:', error);
        // Rollback on error
        setCoreValues(previousValues);
      }
    }
  };

  const handleRemoveValue = async (value: string) => {
    // Store previous state for rollback
    const previousValues = coreValues;

    // Optimistic update - update UI immediately
    const newValues = coreValues.filter((item) => item !== value);
    setCoreValues(newValues);

    // Sync to Supabase in background
    if (isAuthenticated && user?.id) {
      try {
        await removeProfileValue(user.id, value);
      } catch (error) {
        console.error('Failed to remove value from Supabase:', error);
        // Rollback on error
        setCoreValues(previousValues);
      }
    }
  };

  // Save all values when editing is done
  const handleDoneEditing = async () => {
    setIsEditing(false);
    // Sync current values to Supabase
    if (isAuthenticated && user?.id) {
      const nextName = draftFullName.trim();
      if (nextName !== fullName.trim()) {
        // Update locally so Home greeting changes immediately.
        setFullName(nextName);
        try {
          await updateFullName(user.id, nextName);
        } catch (error) {
          console.error('❌ Failed to update name:', error);
        }
      }
      await syncValuesToSupabase(coreValues);
    }
  };

  const birthdayLabel = birthday
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(birthday)
    : 'Not set';

  const handleBirthdaySelect = async (date: Date) => {
    setBirthday(date);
    setIsBirthdayPickerVisible(false);

    if (isAuthenticated && user?.id) {
      try {
        await updateBirthday(user.id, date);
      } catch (error) {
        console.error('❌ Failed to update birthday:', error);
      }
    }
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
    <>
      <ProfileTemplate
        name={fullName.trim() || deriveFullNameFromEmail(user?.email) || 'Profile'}
        role="Professional"
        badgeLabel="Pro Member"
        coreValues={coreValues}
        goals={goals}
        initiatives={initiatives}
        menuItems={menuItems}
        nameValue={draftFullName}
        onChangeName={setDraftFullName}
        personalizationItems={[
          {
            id: 'birthday',
            label: 'Birthday',
            icon: Calendar,
            value: birthdayLabel,
            onPress: () => setIsBirthdayPickerVisible(true),
          },
          ...personalizationItems,
        ]}
        isEditing={isEditing}
        onEditPress={() => {
          setDraftFullName(fullName);
          setIsEditing(true);
        }}
        onDonePress={handleDoneEditing}
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

      <DatePickerPopup
        visible={isBirthdayPickerVisible}
        selectedDate={birthday ?? new Date()}
        onSelect={handleBirthdaySelect}
        onClose={() => setIsBirthdayPickerVisible(false)}
      />
    </>
  );
}

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
