import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { DailyRhythmTemplate } from '@/components/templates';
import { useAuthStore } from '@/stores';

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
      step={3}
      totalSteps={13}
      wakeTime={wakeTime}
      sleepTime={sleepTime}
      onSelectWakeTime={setWakeTime}
      onSelectSleepTime={setSleepTime}
      onContinue={() => router.replace('/home')}
      onBack={() => router.back()}
    />
  );
}
