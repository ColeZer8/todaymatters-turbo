import type { ComponentType } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ArrowRight, Plus } from 'lucide-react-native';
import { GradientButton } from '@/components/atoms';
import { RoutineItemCard } from '@/components/molecules';
import { DraggableRoutineList, SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

export interface RoutineItem {
  id: string;
  title: string;
  minutes: number;
  icon: ComponentType<{ size?: number; color?: string }>;
}

interface RoutineBuilderTemplateProps {
  step?: number;
  totalSteps?: number;
  items: RoutineItem[];
  onReorder: (items: RoutineItem[]) => void;
  onChangeMinutes: (id: string, value: number) => void;
  onDelete: (id: string) => void;
  onAddItem: (title: string) => void;
  quickAddItems?: string[];
  wakeTime?: string;
  onContinue: () => void;
  onBack?: () => void;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const RoutineBuilderTemplate = ({
  step = ONBOARDING_STEPS.routine,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  items,
  onReorder,
  onChangeMinutes,
  onDelete,
  onAddItem,
  quickAddItems = [],
  wakeTime = '06:30',
  onContinue,
  onBack,
}: RoutineBuilderTemplateProps) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Handle panel toggling with smooth transitions when switching between panels
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => {
      if (prev === id) {
        // Closing the same panel
        return null;
      }
      if (prev !== null) {
        // Switching panels: close current first, then open new after a short delay
        setTimeout(() => setExpandedId(id), 50);
        return null;
      }
      // Opening a panel when none is open
      return id;
    });
  }, []);

  const totalMinutes = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.minutes), 0),
    [items],
  );

  const totalLabel = useMemo(() => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `0h ${minutes}m`;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }, [totalMinutes]);

  const getStartEnd = (itemId: string) => {
    const index = items.findIndex((i) => i.id === itemId);
    if (index < 0) return { start: '—', end: '—' };
    const [wakeHour, wakeMinute] = wakeTime.split(':').map((n) => parseInt(n, 10));
    const wakeTotal = wakeHour * 60 + wakeMinute;
    const priorMinutes = items.slice(0, index).reduce((sum, curr) => sum + curr.minutes, 0);
    const start = wakeTotal + priorMinutes;
    const end = start + items[index].minutes;
    const format = (mins: number) => {
      const total = mins % (24 * 60);
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    return { start: format(start), end: format(end) };
  };

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Build your routine"
      subtitle="Stack your habits. What comes first?"
      onBack={onBack}
      footer={
        <View className="gap-3">
          <View className="flex-row justify-between px-1">
            <View>
              <Text className="text-sm font-semibold text-text-secondary">Total Duration</Text>
              <Text className="text-xl font-bold text-text-primary">{totalLabel}</Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-semibold text-text-secondary">Wake Up</Text>
              <Text className="text-xl font-bold text-text-primary">{wakeTime}</Text>
            </View>
          </View>
          <GradientButton label="Looks Good" onPress={onContinue} rightIcon={ArrowRight} />
        </View>
      }
    >
      <View className="mt-4 gap-3">
        <View className="relative">
          <DraggableRoutineList
            items={items}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onChangeMinutes={onChangeMinutes}
            onDelete={onDelete}
            onReorder={onReorder}
            onDragStart={() => setExpandedId(null)}
            getStartEnd={getStartEnd}
          />
        </View>

        {showAdd ? (
          <View className="rounded-3xl border border-[#E4E8F0] bg-white px-4 py-4" style={cardShadowStyle}>
            <Text className="text-base font-semibold text-text-primary">Add to routine</Text>
            <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-brand-primary/60 bg-white px-3 py-2">
              <TextInput
                value={newItem}
                onChangeText={setNewItem}
                placeholder="e.g. Feed the cat"
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-base text-text-primary"
              />
              <Pressable
                onPress={() => {
                  if (!newItem.trim()) return;
                  onAddItem(newItem.trim());
                  setNewItem('');
                  setShowAdd(false);
                }}
                className="rounded-xl bg-brand-primary px-4 py-2"
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <Text className="text-base font-semibold text-white">Add</Text>
              </Pressable>
            </View>

            {quickAddItems.length ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {quickAddItems.map((quick) => (
                  <Pressable
                    key={quick}
                    onPress={() => {
                      onAddItem(quick);
                      setShowAdd(false);
                    }}
                    className="rounded-xl border border-[#D1DBEC] bg-[#F8FAFF] px-3 py-2"
                    style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                  >
                    <Text className="text-sm font-semibold text-text-primary">+ {quick}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                setShowAdd(false);
                setNewItem('');
              }}
              className="mt-3 items-center"
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text className="text-sm font-semibold text-text-secondary">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAdd(true)}
            className="flex-row items-center justify-center gap-2 rounded-3xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-4 py-5"
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <Plus size={18} color="#2563EB" />
            <Text className="text-base font-semibold text-brand-primary">Add habit</Text>
          </Pressable>
        )}
      </View>
    </SetupStepLayout>
  );
};
