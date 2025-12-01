import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { DailyRhythmTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

const createTime = (hours: number, minutes: number) => {
  const time = new Date();
  time.setHours(hours);
  time.setMinutes(minutes);
  time.setSeconds(0);
  time.setMilliseconds(0);
  return time;
};

export default function DailyRhythmScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const isNavigationReady = navigationState?.key != null && navigationState?.routes?.length > 0;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [wakeTime, setWakeTime] = useState(() => createTime(6, 30));
  const [sleepTime, setSleepTime] = useState(() => createTime(22, 30));

  useEffect(() => {
    if (!isNavigationReady) return;
    if (!isAuthenticated) {
      InteractionManager.runAfterInteractions(() => {
        router.replace('/');
      });
    }
  }, [isAuthenticated, isNavigationReady, router]);

  return (
    <DailyRhythmTemplate
      step={ONBOARDING_STEPS.dailyRhythm}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      wakeTime={wakeTime}
      sleepTime={sleepTime}
      onSelectWakeTime={setWakeTime}
      onSelectSleepTime={setSleepTime}
      onContinue={() => router.replace('/joy')}
      onBack={() => router.replace('/setup-questions')}
    />
  );
}
