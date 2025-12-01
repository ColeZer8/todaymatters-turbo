import { Stack } from 'expo-router';
import { CategoryHealthTemplate } from '@/components/templates';

export default function HealthHealthScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CategoryHealthTemplate categoryId="health" />
    </>
  );
}

