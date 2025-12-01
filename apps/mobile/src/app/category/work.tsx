import { Stack } from 'expo-router';
import { CategoryHealthTemplate } from '@/components/templates';

export default function WorkHealthScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CategoryHealthTemplate categoryId="work" />
    </>
  );
}

