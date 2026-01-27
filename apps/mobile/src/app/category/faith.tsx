import { Stack } from "expo-router";
import { CategoryHealthTemplate } from "@/components/templates";

export default function FaithHealthScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CategoryHealthTemplate categoryId="faith" />
    </>
  );
}
