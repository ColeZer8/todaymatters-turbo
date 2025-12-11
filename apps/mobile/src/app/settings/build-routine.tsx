import { useRouter } from 'expo-router';
import { RoutineBuilderTemplate } from '@/components/templates/RoutineBuilderTemplate';
import { useRoutineBuilderStore } from '@/stores/routine-builder-store';

const QUICK_ADD = ['Brush Teeth', 'Shower', 'Make Bed', 'Read', 'Meditate', 'Walk Dog', 'Make Breakfast'];

export default function SettingsBuildRoutineScreen() {
  const router = useRouter();

  const items = useRoutineBuilderStore((state) => state.items);
  const wakeTime = useRoutineBuilderStore((state) => state.wakeTime);
  const setItems = useRoutineBuilderStore((state) => state.setItems);
  const updateMinutes = useRoutineBuilderStore((state) => state.updateMinutes);
  const addItem = useRoutineBuilderStore((state) => state.addItem);
  const deleteItem = useRoutineBuilderStore((state) => state.deleteItem);

  return (
    <RoutineBuilderTemplate
      mode="settings"
      items={items}
      onReorder={setItems}
      onChangeMinutes={updateMinutes}
      onDelete={deleteItem}
      onAddItem={addItem}
      quickAddItems={QUICK_ADD}
      wakeTime={wakeTime}
      onBack={() => router.back()}
    />
  );
}
