import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Calendar,
  Clock,
  Flag,
  Sparkles,
  Heart,
  Briefcase,
  Activity,
  Plus,
} from 'lucide-react-native';
import { Icon } from '../atoms';
import { DatePickerPopup } from '../molecules/DatePickerPopup';
import { TimePickerModal } from '../organisms/TimePickerModal';

// Life area options with icons
const LIFE_AREAS = [
  { id: 'faith', label: 'Faith', icon: Sparkles },
  { id: 'family', label: 'Family', icon: Heart },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'health', label: 'Health', icon: Activity },
];

// Default values options
const DEFAULT_VALUES = ['Family', 'Integrity', 'Creativity'];

const formatDate = (date: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

const formatTime = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const AddEventTemplate = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(() => {
    const date = new Date();
    date.setHours(9, 30, 0, 0);
    return date;
  });
  const [endTime, setEndTime] = useState(() => {
    const date = new Date();
    date.setHours(11, 30, 0, 0);
    return date;
  });
  const [isBigThree, setIsBigThree] = useState(false);
  const [selectedLifeArea, setSelectedLifeArea] = useState<string | null>('work');
  const [selectedValues, setSelectedValues] = useState<string[]>(['Creativity']);

  // Modal state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const handleClose = () => {
    router.back();
  };

  const handleSave = () => {
    // TODO: Save event logic
    console.log('Saving event:', {
      title,
      selectedDate,
      startTime,
      endTime,
      isBigThree,
      selectedLifeArea,
      selectedValues,
    });
    router.back();
  };

  const handleDelete = () => {
    // TODO: Delete event logic
    router.back();
  };

  const toggleValue = (value: string) => {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <LinearGradient
              colors={['#4D8BFF', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Text style={styles.logoText}>TM</Text>
            </LinearGradient>
            <Text style={styles.brandText}>TODAY MATTERS</Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Icon icon={X} size={20} color="#6B7280" />
          </Pressable>
        </View>

        {/* Title Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHAT NEEDS TO BE DONE?</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter event title..."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Date & Time Row */}
        <View style={styles.dateTimeRow}>
          <Pressable
            style={[styles.dateTimePill, showDatePicker && styles.dateTimePillActive]}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon icon={Calendar} size={18} color="#2563EB" />
            <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
          </Pressable>

          <Pressable
            style={styles.timeRangePill}
            onPress={() => setShowStartTimePicker(true)}
          >
            <Icon icon={Clock} size={18} color="#F97316" />
            <Text style={styles.dateTimeText}>
              {formatTime(startTime)} - {formatTime(endTime)}
            </Text>
          </Pressable>
        </View>

        {/* Mark as Big 3 */}
        <Pressable
          style={[styles.bigThreeButton, isBigThree && styles.bigThreeButtonActive]}
          onPress={() => setIsBigThree(!isBigThree)}
        >
          <Icon icon={Flag} size={18} color="#F59E0B" />
          <Text style={[styles.bigThreeText, isBigThree && styles.bigThreeTextActive]}>
            Mark as Big 3
          </Text>
        </Pressable>

        {/* Life Area Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LIFE AREA</Text>
          <View style={styles.pillsRow}>
            {LIFE_AREAS.map((area) => {
              const isSelected = selectedLifeArea === area.id;
              return (
                <Pressable
                  key={area.id}
                  style={[styles.lifeAreaPill, isSelected && styles.lifeAreaPillSelected]}
                  onPress={() => setSelectedLifeArea(area.id)}
                >
                  <Icon
                    icon={area.icon}
                    size={16}
                    color={isSelected ? '#2563EB' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.lifeAreaText,
                      isSelected && styles.lifeAreaTextSelected,
                    ]}
                  >
                    {area.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Align with Values Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALIGN WITH VALUES</Text>
          <View style={styles.pillsRow}>
            {DEFAULT_VALUES.map((value) => {
              const isSelected = selectedValues.includes(value);
              return (
                <Pressable
                  key={value}
                  style={[styles.valuePill, isSelected && styles.valuePillSelected]}
                  onPress={() => toggleValue(value)}
                >
                  <Text
                    style={[styles.valueText, isSelected && styles.valueTextSelected]}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.addValuePill}>
              <Icon icon={Plus} size={14} color="#9CA3AF" />
              <Text style={styles.addValueText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable onPress={handleSave} style={styles.saveButtonWrapper}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete Event</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Date Picker Popup */}
      <DatePickerPopup
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Time Picker Modals */}
      <TimePickerModal
        visible={showStartTimePicker}
        label="Start Time"
        initialTime={startTime}
        onConfirm={(time) => {
          setStartTime(time);
          setShowStartTimePicker(false);
          // Auto-open end time picker after selecting start
          setTimeout(() => setShowEndTimePicker(true), 300);
        }}
        onClose={() => setShowStartTimePicker(false)}
      />

      <TimePickerModal
        visible={showEndTimePicker}
        label="End Time"
        initialTime={endTime}
        onConfirm={(time) => {
          setEndTime(time);
          setShowEndTimePicker(false);
        }}
        onClose={() => setShowEndTimePicker(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#9CA3AF',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    paddingVertical: 0,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateTimePillActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  timeRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateTimeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  bigThreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  bigThreeButtonActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  bigThreeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#D97706',
  },
  bigThreeTextActive: {
    color: '#B45309',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  lifeAreaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lifeAreaPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  lifeAreaText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  lifeAreaTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  valuePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  valuePillSelected: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  valueTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addValuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  addValueText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
  saveButtonWrapper: {
    width: '100%',
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#D1D5DB',
  },
});


