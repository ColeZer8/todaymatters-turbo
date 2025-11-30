import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowRight, Edit3, Plus, Trash2 } from 'lucide-react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { IdealDayCategory } from '@/stores/ideal-day-store';
import { AnalyticsDonutChart } from '@/components/molecules/AnalyticsDonutChart';

interface IdealDayTemplateProps {
  step?: number;
  totalSteps?: number;
  categories: IdealDayCategory[];
  dayType: 'weekdays' | 'weekends' | 'custom';
  onDayTypeChange: (type: IdealDayTemplateProps['dayType']) => void;
  onCategoryHoursChange: (id: string, hours: number) => void;
  onAddCategory: (name: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
}

const DAY_TYPES: Array<{ key: IdealDayTemplateProps['dayType']; label: string }> = [
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'custom', label: 'Custom' },
];

const WEEKDAY_KEYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const palette = ['#4F8BFF', '#22A776', '#F59E0B', '#EC4899', '#F97316', '#7C3AED', '#10B981'];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface SliderBarProps {
  id: string;
  label: string;
  color: string;
  hours: number;
  maxHours: number;
  onChange: (hours: number) => void;
  onDelete?: () => void;
}

const SliderBar = ({ label, color, hours, maxHours, onChange, onDelete }: SliderBarProps) => {
  const [width, setWidth] = useState(0);
  const trackRef = useRef<View>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const updateFromGesture = (gestureX: number, pageX: number) => {
    if (!width || !trackRef.current) return;
    const localX = gestureX - pageX;
    const clampedPx = clamp(localX, 0, width);
    const newHours = Math.round((clampedPx / width) * maxHours * 2) / 2;
    onChange(newHours);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX } = evt.nativeEvent;
          updateFromGesture(locationX, 0);
        },
        onPanResponderMove: (evt) => {
          const { locationX } = evt.nativeEvent;
          updateFromGesture(locationX, 0);
        },
      }),
    [width],
  );

  const filledWidth = width ? clamp((hours / maxHours) * width, 0, width) : 0;

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-3">
      <View className="h-full w-2 rounded-full" style={{ backgroundColor: color }} />
      <View className="flex-1 gap-2">
        <Text className="text-base font-semibold" style={{ color }}>{label}</Text>
        <View
          className="h-4 rounded-full bg-[#EFF2F7]"
          onLayout={handleLayout}
          ref={trackRef}
          {...panResponder.panHandlers}
        >
          <View
            className="h-full rounded-full"
            style={{ width: filledWidth, backgroundColor: color }}
          />
        </View>
      </View>
      <View className="min-w-[44px] rounded-lg border border-[#E5E7EB] bg-white px-2 py-1">
        <Text className="text-right text-base font-semibold text-text-primary">{hours}</Text>
      </View>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6]"
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <Trash2 size={16} color="#6B7280" />
        </Pressable>
      ) : null}
    </View>
  );
};

export const IdealDayTemplate = ({
  step = ONBOARDING_STEPS.idealDay,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  categories,
  dayType,
  onDayTypeChange,
  onCategoryHoursChange,
  onAddCategory,
  onDeleteCategory,
  onContinue,
  onSkip,
}: IdealDayTemplateProps) => {
  const totalHours = useMemo(() => categories.reduce((sum, cat) => sum + cat.hours, 0), [categories]);
  const freeTime = Math.max(0, 24 - totalHours);
  const [newName, setNewName] = useState('');
  const [newColorIndex, setNewColorIndex] = useState(0);
  const nextColor = palette[newColorIndex % palette.length];
  const [isEditing, setIsEditing] = useState(false);

  const segments = useMemo(
    () =>
      categories
        .filter((cat) => cat.hours > 0)
        .map((cat) => ({ value: cat.hours, color: cat.color })),
    [categories],
  );

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Ideal day"
      subtitle="Plan your time so you can focus on what matters."
      onBack={onSkip}
      footer={
        <GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />
      }
    >
      <View className="mt-4 gap-4">
        <View className="rounded-2xl border border-[#E5E7EB] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
          <View className="flex-row items-center justify-center gap-2 rounded-full bg-[#F2F6FF] px-2 py-1">
          {DAY_TYPES.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => onDayTypeChange(tab.key)}
              className={`rounded-full px-3 py-2 ${dayType === tab.key ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`text-xs font-semibold uppercase tracking-[1px] ${dayType === tab.key ? 'text-brand-primary' : 'text-text-secondary'}`}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center justify-between mt-3">
          {WEEKDAY_KEYS.map((day, idx) => (
            <View
              key={`${day}-${idx}`}
              className={`h-12 w-12 items-center justify-center rounded-lg ${idx < 5 ? 'bg-brand-primary' : 'bg-[#F4F7FB]'}`}
            >
              <Text className={`text-base font-semibold ${idx < 5 ? 'text-white' : 'text-text-secondary'}`}>{day}</Text>
            </View>
          ))}
        </View>
        <Text className="text-center text-xs font-semibold text-text-tertiary mt-2">NO DAYS SAVED</Text>
        </View>

        <View className="items-center">
          <View className="relative items-center justify-center" style={{ height: 180 }}>
            <AnalyticsDonutChart
              data={segments.map((s, idx) => ({ label: `${idx}`, value: s.value, color: s.color }))}
              radius={56}
              strokeWidth={28}
              startAngle={-90}
            />
            <View className="absolute items-center justify-center">
              <Text className="text-brand-primary" style={{ fontSize: 22, fontWeight: '800' }}>
                {totalHours % 1 === 0 ? `${totalHours}` : totalHours.toFixed(1)}h
              </Text>
              <Text className="uppercase text-[#6B7280]" style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                Planned
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-2xl border border-[#DFE7F2] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
          <View className="flex-row items-center justify-between px-1 pb-2">
            <Text className="text-base font-semibold text-brand-primary">Free time:</Text>
            <Text className="text-base font-semibold text-text-primary">{freeTime.toFixed(1)}h</Text>
          </View>
          <View className="h-4 rounded-full bg-[#E9EEF5] overflow-hidden">
            <View className="h-full rounded-r-full" style={{ width: `${(freeTime / 24) * 100}%`, backgroundColor: '#AFC8FF' }} />
          </View>
        </View>

        <View className="mt-2 gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[1px] text-text-secondary">Activities</Text>
          {categories.map((cat) => (
            <SliderBar
              key={cat.id}
              label={cat.name}
              color={cat.color}
              hours={cat.hours}
              maxHours={cat.maxHours}
              onChange={(hours) => onCategoryHoursChange(cat.id, hours)}
              onDelete={isEditing && categories.length > 3 ? () => onDeleteCategory(cat.id) : undefined}
            />
          ))}
        </View>

        {isEditing ? (
          <View className="gap-3 rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
            <Text className="text-base font-semibold text-text-primary">Edit categories</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="New category"
                placeholderTextColor="#9CA3AF"
                className="flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-base text-text-primary"
              />
              <Pressable
                onPress={() => setNewColorIndex((prev) => prev + 1)}
                className="h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB]"
                style={{ backgroundColor: nextColor }}
              />
              <Pressable
                onPress={() => {
                  if (!newName.trim()) return;
                  onAddCategory(newName.trim(), nextColor);
                  setNewName('');
                }}
                className="rounded-xl bg-brand-primary px-4 py-2"
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <Text className="text-base font-semibold text-white">Add</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setIsEditing(false)}
              className="items-center"
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text className="text-sm font-semibold text-text-secondary">Done editing</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setIsEditing(true)}
            className="absolute bottom-4 right-4 h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary shadow-[0_4px_12px_rgba(37,99,235,0.35)]"
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <Edit3 size={20} color="#FFFFFF" />
          </Pressable>
        )}

        {onSkip ? (
          <Pressable
            onPress={onSkip}
            className="items-center"
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text className="text-sm font-semibold text-text-secondary">I&apos;ll do this later</Text>
          </Pressable>
        ) : null}
      </View>
    </SetupStepLayout>
  );
};
