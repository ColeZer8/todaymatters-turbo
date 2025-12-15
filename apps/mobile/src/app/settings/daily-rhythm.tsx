import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { DailyRhythmTemplate } from '@/components/templates';
import { useOnboardingStore } from '@/stores/onboarding-store';

export default function SettingsDailyRhythmScreen() {
  const router = useRouter();

  const wakeTimeStr = useOnboardingStore((state) => state.wakeTime);
  const sleepTimeStr = useOnboardingStore((state) => state.sleepTime);
  const setWakeTime = useOnboardingStore((state) => state.setWakeTime);
  const setSleepTime = useOnboardingStore((state) => state.setSleepTime);

  const wakeTime = useMemo(() => new Date(wakeTimeStr), [wakeTimeStr]);
  const sleepTime = useMemo(() => new Date(sleepTimeStr), [sleepTimeStr]);

  return (
    <DailyRhythmTemplate
      mode="settings"
      wakeTime={wakeTime}
      sleepTime={sleepTime}
      onSelectWakeTime={setWakeTime}
      onSelectSleepTime={setSleepTime}
      onBack={() => router.back()}
    />
  );
}


