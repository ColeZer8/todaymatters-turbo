import { Stack } from 'expo-router';
import { ReviewTimeTemplate } from '@/components/templates';

export default function ReviewTimeScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReviewTimeTemplate />
    </>
  );
}

