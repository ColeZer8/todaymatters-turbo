import { useMemo, useRef, useState, type ComponentType } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, Text, TextInput, View } from 'react-native';
import { ArrowRight, Edit3, Clock, Trash2 } from 'lucide-react-native';
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
  selectedDays: number[];
  onToggleDay: (dayIndex: number) => void;
}

const DAY_TYPES: Array<{ key: IdealDayTemplateProps['dayType']; label: string }> = [
  { key: 'weekdays', label: 'Weekdays' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'custom', label: 'Custom' },
];

const WEEKDAY_LABELS = [
  { short: 'M', full: 'Mon' },
  { short: 'T', full: 'Tue' },
  { short: 'W', full: 'Wed' },
  { short: 'T', full: 'Thu' },
  { short: 'F', full: 'Fri' },
  { short: 'S', full: 'Sat' },
  { short: 'S', full: 'Sun' },
];

const palette = ['#4F8BFF', '#1FA56E', '#F59E0B', '#F33C83', '#F95C2E', '#7C3AED', '#10B981'];
const freeColor = '#93C5FD';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface SliderBarProps {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  color: string;
  hours: number;
  maxHours: number;
  onChange: (hours: number) => void;
  onDelete?: () => void;
}

const SliderBar = ({ icon: Icon, label, color, hours, maxHours, onChange, onDelete }: SliderBarProps) => {
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
    <View className="flex-row items-center gap-3 rounded-2xl bg-white px-3 py-3" style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
        <Icon size={20} color={color} />
      </View>
      <View className="flex-1 gap-1.5">
        <Text className="text-[15px] font-semibold" style={{ color }}>{label}</Text>
        <View
          className="h-3 rounded-full bg-[#F1F5F9]"
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
      <View className="min-w-[44px] rounded-xl bg-[#F8FAFC] px-2.5 py-1.5" style={{ borderWidth: 1, borderColor: '#E2E8F0' }}>
        <Text className="text-center text-[15px] font-bold text-text-primary">{hours}</Text>
      </View>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#FEE2E2]"
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <Trash2 size={16} color="#EF4444" />
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
  selectedDays,
  onToggleDay,
}: IdealDayTemplateProps) => {
  const totalHours = useMemo(() => categories.reduce((sum, cat) => sum + cat.hours, 0), [categories]);
  const freeTime = Math.max(0, 24 - totalHours);
  const [newName, setNewName] = useState('');
  const [newColorIndex, setNewColorIndex] = useState(0);
  const nextColor = palette[newColorIndex % palette.length];
  const [isEditing, setIsEditing] = useState(false);

  const segments = useMemo(() => {
    const data = categories
      .filter((cat) => cat.hours > 0)
      .map((cat) => ({ label: cat.name, value: cat.hours, color: cat.color }));
    if (freeTime > 0) {
      data.unshift({ label: 'Free', value: freeTime, color: freeColor });
    }
    return data;
  }, [categories, freeTime]);

  // Format hours display
  const formatHours = (h: number) => {
    if (h % 1 === 0) return `${h}h`;
    return `${h.toFixed(1)}h`;
  };

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Ideal day"
      subtitle="Plan your time so you can focus on what matters."
      footer={
        <GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />
      }
    >
      <View className="mt-1 gap-4">
        {/* Day Selection Card */}
        <View className="rounded-2xl bg-white p-4" style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 }}>
          {/* Day Type Toggle */}
          <View className="flex-row items-center justify-center rounded-xl bg-[#F1F5F9] p-1">
            {DAY_TYPES.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => onDayTypeChange(tab.key)}
                className={`flex-1 items-center rounded-lg py-2 ${dayType === tab.key ? 'bg-white' : ''}`}
                style={dayType === tab.key ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : undefined}
              >
                <Text className={`text-[13px] font-semibold ${dayType === tab.key ? 'text-brand-primary' : 'text-[#64748B]'}`}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Weekday Buttons */}
          <View className="mt-4 flex-row items-center justify-between">
            {WEEKDAY_LABELS.map((day, idx) => {
              const isSelected = selectedDays.includes(idx);
              const active = dayType === 'custom' ? isSelected : idx < 5 ? dayType === 'weekdays' : dayType === 'weekends';
              return (
                <Pressable
                  key={`${day.short}-${idx}`}
                  disabled={dayType !== 'custom'}
                  onPress={() => onToggleDay(idx)}
                  className={`h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-brand-primary' : 'bg-[#F1F5F9]'}`}
                  style={({ pressed }) => [{ opacity: pressed && dayType === 'custom' ? 0.8 : 1 }]}
                >
                  <Text className={`text-[15px] font-semibold ${active ? 'text-white' : 'text-[#94A3B8]'}`}>
                    {day.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Donut Chart with Free Time */}
        <View className="rounded-2xl bg-white p-4" style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 }}>
          <View className="flex-row items-center">
            {/* Chart */}
            <View className="relative items-center justify-center" style={{ width: 140, height: 140 }}>
              <AnalyticsDonutChart
                data={segments.map((s, idx) => ({ label: `${s.label}-${idx}`, value: s.value, color: s.color }))}
                radius={44}
                strokeWidth={22}
                startAngle={-90}
              />
              <View className="absolute items-center justify-center">
                <Text className="text-brand-primary" style={{ fontSize: 22, fontWeight: '800' }}>
                  {formatHours(totalHours)}
                </Text>
                <Text className="uppercase text-[#94A3B8]" style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>
                  Planned
                </Text>
              </View>
            </View>

            {/* Free Time Info */}
            <View className="flex-1 ml-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Clock size={16} color="#64748B" />
                <Text className="text-[13px] font-medium text-[#64748B]">Remaining</Text>
              </View>
              <Text className="text-[28px] font-bold text-text-primary mb-1">
                {formatHours(freeTime)}
              </Text>
              <Text className="text-[13px] text-[#94A3B8]">Free time available</Text>
              
              {/* Mini progress bar */}
              <View className="mt-3 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{ width: `${(freeTime / 24) * 100}%`, backgroundColor: freeColor }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Activities Section */}
        <View className="gap-3">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] px-1">
            Activities
          </Text>
          {categories.map((cat) => (
            <SliderBar
              key={cat.id}
              icon={cat.icon}
              label={cat.name}
              color={cat.color}
              hours={cat.hours}
              maxHours={cat.maxHours}
              onChange={(hours) => onCategoryHoursChange(cat.id, hours)}
              onDelete={isEditing && categories.length > 3 ? () => onDeleteCategory(cat.id) : undefined}
            />
          ))}
        </View>

        {/* Edit Mode */}
        {isEditing ? (
          <View className="gap-3 rounded-2xl bg-white p-4" style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 }}>
            <Text className="text-[15px] font-semibold text-text-primary">Add Category</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Category name"
                placeholderTextColor="#94A3B8"
                className="flex-1 rounded-xl bg-[#F8FAFC] px-4 py-3 text-[15px] text-text-primary"
                style={{ borderWidth: 1, borderColor: '#E2E8F0' }}
              />
              <Pressable
                onPress={() => setNewColorIndex((prev) => prev + 1)}
                className="h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: nextColor }}
              />
              <Pressable
                onPress={() => {
                  if (!newName.trim()) return;
                  onAddCategory(newName.trim(), nextColor);
                  setNewName('');
                }}
                className="rounded-xl bg-brand-primary px-5 py-3"
                style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
              >
                <Text className="text-[15px] font-semibold text-white">Add</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => setIsEditing(false)}
              className="items-center py-2"
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text className="text-[14px] font-semibold text-brand-primary">Done</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setIsEditing(true)}
            className="absolute bottom-4 right-4 h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary"
            style={({ pressed }) => [
              { opacity: pressed ? 0.9 : 1 },
              { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }
            ]}
          >
            <Edit3 size={22} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </SetupStepLayout>
  );
};
