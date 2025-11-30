import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowRight, Edit3, Plus, Trash2 } from 'lucide-react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import type { IdealDayCategory } from '@/stores/ideal-day-store';

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

const Ring = ({ segments, totalHours }: { segments: { value: number; color: string }[]; totalHours: number }) => {
  const radius = 48;
  let startAngle = -90;

  const paths = segments.map((segment) => {
    const percent = clamp(segment.value / 24, 0, 1);
    const sweep = percent * 360;
    const endAngle = startAngle + sweep;
    const largeArc = sweep > 180 ? 1 : 0;
    const startRad = (Math.PI / 180) * startAngle;
    const endRad = (Math.PI / 180) * endAngle;
    const x1 = 60 + radius * Math.cos(startRad);
    const y1 = 60 + radius * Math.sin(startRad);
    const x2 = 60 + radius * Math.cos(endRad);
    const y2 = 60 + radius * Math.sin(endRad);
    startAngle = endAngle;
    return {
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      color: segment.color,
    };
  });

  const planned = clamp(totalHours, 0, 24);

  return (
    <Svg width={140} height={140} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="48" stroke="#E5EAF5" strokeWidth="16" fill="none" />
      <G strokeWidth="16" fill="none" strokeLinecap="round">
        {paths.map((p, idx) => (
          <Path key={idx} d={p.d} stroke={p.color} />
        ))}
      </G>
      <Text
        accessibilityRole="text"
        style={{
          position: 'absolute',
          top: 44,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontWeight: '800',
          fontSize: 22,
          color: '#2563EB',
        }}
      >
        {planned}h
      </Text>
      <Text
        accessibilityRole="text"
        style={{
          position: 'absolute',
          top: 72,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontWeight: '700',
          fontSize: 12,
          color: '#6B7280',
          letterSpacing: 1,
        }}
      >
        PLANNED
      </Text>
    </Svg>
  );
};

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
      <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22` }}>
        <View className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
      </View>
      <View className="flex-1 gap-2">
        <Text className="text-base font-semibold text-text-primary">{label}</Text>
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
      <Text className="w-10 text-right text-base font-semibold text-text-primary">{hours}</Text>
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
        <View className="flex-row items-center justify-center gap-2 rounded-full bg-[#EAF1FF] px-3 py-1">
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

        <View className="flex-row items-center justify-between">
          {WEEKDAY_KEYS.map((day, idx) => (
            <View
              key={`${day}-${idx}`}
              className={`h-12 w-12 items-center justify-center rounded-xl ${idx < 5 ? 'bg-brand-primary' : 'bg-[#F4F7FB]'}`}
            >
              <Text className={`text-base font-semibold ${idx < 5 ? 'text-white' : 'text-text-secondary'}`}>{day}</Text>
            </View>
          ))}
        </View>

        <View className="items-center">
          <Ring totalHours={totalHours} segments={segments} />
        </View>

        <View className="rounded-2xl border border-[#E4E8F0] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,0.05)]">
          <View className="flex-row items-center justify-between px-1 pb-2">
            <Text className="text-base font-semibold text-brand-primary">Free time:</Text>
            <Text className="text-base font-semibold text-text-primary">{freeTime.toFixed(1)}h</Text>
          </View>
          <View className="h-4 rounded-full bg-[#EFF2F7]">
            <View
              className="h-full rounded-full bg-brand-primary/30"
              style={{ width: `${(freeTime / 24) * 100}%` }}
            />
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
