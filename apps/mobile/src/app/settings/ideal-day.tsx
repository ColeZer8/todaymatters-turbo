import { useRouter } from 'expo-router';
import { IdealDayTemplate } from '@/components/templates';
import { useIdealDayStore } from '@/stores/ideal-day-store';

export default function SettingsIdealDayScreen() {
  const router = useRouter();

  const categories = useIdealDayStore((state) => state.categoriesByType[state.dayType]);
  const categoriesByType = useIdealDayStore((state) => state.categoriesByType);
  const dayType = useIdealDayStore((state) => state.dayType);
  const setDayType = useIdealDayStore((state) => state.setDayType);
  const setHours = useIdealDayStore((state) => state.setHours);
  const addCategory = useIdealDayStore((state) => state.addCategory);
  const deleteCategory = useIdealDayStore((state) => state.deleteCategory);
  const selectedDays = useIdealDayStore((state) => state.selectedDaysByType[state.dayType]);
  const selectedDaysByType = useIdealDayStore((state) => state.selectedDaysByType);
  const customDayConfigs = useIdealDayStore((state) => state.customDayConfigs);
  const toggleDay = useIdealDayStore((state) => state.toggleDay);

  return (
    <IdealDayTemplate
      mode="settings"
      categories={categories}
      categoriesByType={categoriesByType}
      dayType={dayType}
      selectedDays={selectedDays}
      selectedDaysByType={selectedDaysByType}
      customDayConfigs={customDayConfigs}
      onToggleDay={toggleDay}
      onDayTypeChange={setDayType}
      onCategoryHoursChange={setHours}
      onAddCategory={addCategory}
      onDeleteCategory={deleteCategory}
      onBack={() => router.back()}
    />
  );
}
