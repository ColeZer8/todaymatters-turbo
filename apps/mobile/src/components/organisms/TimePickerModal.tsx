import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeModules,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  requireNativeComponent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';
import { GradientButton, Icon } from '../atoms';

interface TimePickerModalProps {
  visible: boolean;
  label: string;
  initialTime: Date;
  onConfirm: (time: Date) => void;
  onClose: () => void;
}

type ColumnType = 'hour' | 'minute' | 'period';

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];
const ROW_HEIGHT = 46;

const getInitialIndex = (type: ColumnType, date: Date) => {
  if (type === 'hour') {
    const hour = date.getHours();
    const normalized = hour % 12 || 12;
    return HOURS.indexOf(String(normalized).padStart(2, '0'));
  }
  if (type === 'minute') {
    const minute = date.getMinutes();
    const rounded = Math.round(minute / 5) * 5;
    const safe = rounded >= 60 ? 0 : rounded;
    return MINUTES.indexOf(String(safe).padStart(2, '0'));
  }
  return date.getHours() >= 12 ? 1 : 0;
};

const toDate = (hourIndex: number, minuteIndex: number, periodIndex: number) => {
  const hourValue = hourIndex + 1;
  const minuteValue = minuteIndex * 5;
  const isPM = periodIndex === 1;
  const hour24 = hourValue % 12 + (isPM ? 12 : 0);
  const next = new Date();
  next.setHours(hour24);
  next.setMinutes(minuteValue);
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next;
};

interface WheelColumnProps {
  type: ColumnType;
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const WheelColumn = ({ type, data, selectedIndex, onSelect }: WheelColumnProps) => {
  const label = type === 'hour' ? 'Hour' : type === 'minute' ? 'Minute' : 'Period';

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  };

  return (
    <View style={styles.column}>
      <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</Text>
      <View style={styles.wheelShell}>
        <View pointerEvents="none" style={styles.wheelHighlight} />
        <FlatList
          data={data}
          keyExtractor={(item) => `${type}-${item}`}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast"
          contentContainerStyle={styles.wheelContent}
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
          initialScrollIndex={selectedIndex}
          onMomentumScrollEnd={handleMomentumEnd}
          renderItem={({ item, index }) => {
            const isActive = index === selectedIndex;
            return (
              <View style={[styles.wheelItem, isActive && styles.wheelItemActive]}>
                <Text
                  className="text-lg font-semibold"
                  style={[styles.wheelText, isActive && styles.wheelTextActive]}
                >
                  {item}
                </Text>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
};

export const TimePickerModal = ({
  visible,
  label,
  initialTime,
  onConfirm,
  onClose,
}: TimePickerModalProps) => {
  const hasNativePicker =
    Platform.OS !== 'ios'
      ? true
      : (() => {
          try {
            const hasModule =
              Boolean(NativeModules?.RNDateTimePicker) || Boolean(NativeModules?.RNDateTimePickerManager);
            const component = requireNativeComponent?.('RNDateTimePicker');
            const isComponentAvailable = Boolean(component);
            console.log('RNDateTimePicker check', {
              platform: Platform.OS,
              hasModule,
              hasManager: Boolean(NativeModules?.RNDateTimePickerManager),
              isComponentAvailable,
              keys: Object.keys(NativeModules || {}),
            });
            if (!hasModule || !isComponentAvailable) {
              console.warn('RNDateTimePicker native module not detected; rendering fallback wheel.');
            }
            return hasModule && isComponentAvailable;
          } catch {
            console.warn('RNDateTimePicker requireNativeComponent failed; rendering fallback wheel.');
            return false;
          }
        })();
  useEffect(() => {
    console.log('RNDateTimePicker module snapshot', {
      platform: Platform.OS,
      pickerModule: NativeModules?.RNDateTimePicker,
      pickerManager: NativeModules?.RNDateTimePickerManager,
    });
  }, []);
  const [selectedTime, setSelectedTime] = useState(initialTime);
  const [hourIndex, setHourIndex] = useState(() => getInitialIndex('hour', initialTime));
  const [minuteIndex, setMinuteIndex] = useState(() => getInitialIndex('minute', initialTime));
  const [periodIndex, setPeriodIndex] = useState(() => getInitialIndex('period', initialTime));

  useEffect(() => {
    if (visible) {
      setSelectedTime(initialTime);
      setHourIndex(getInitialIndex('hour', initialTime));
      setMinuteIndex(getInitialIndex('minute', initialTime));
      setPeriodIndex(getInitialIndex('period', initialTime));
    }
  }, [initialTime, visible]);

  const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (!date) return;
    setSelectedTime(date);
  };

  const fallbackSelectedTime = useMemo(
    () => toDate(hourIndex, minuteIndex, periodIndex),
    [hourIndex, minuteIndex, periodIndex],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable
          accessible={false}
          onPress={(event) => event.stopPropagation()}
          style={styles.modalCard}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBlock}>
              <Text className="text-lg font-bold text-text-primary">{label}</Text>
              <Text className="text-sm leading-5 text-text-secondary">
                Choose a time that matches your everyday rhythm.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Icon icon={X} size={18} color="#0f172a" />
            </Pressable>
          </View>

          <View style={styles.pickerShell}>
            {hasNativePicker ? (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                onChange={handleChange}
                minuteInterval={5}
                themeVariant="light"
                style={styles.nativePicker}
                {...(Platform.OS === 'ios' ? { preferredDatePickerStyle: 'wheels' } : {})}
              />
            ) : (
              <View style={styles.wheelsRow}>
                <WheelColumn
                  type="hour"
                  data={HOURS}
                  selectedIndex={hourIndex}
                  onSelect={setHourIndex}
                />
                <WheelColumn
                  type="minute"
                  data={MINUTES}
                  selectedIndex={minuteIndex}
                  onSelect={setMinuteIndex}
                />
                <WheelColumn
                  type="period"
                  data={PERIODS}
                  selectedIndex={periodIndex}
                  onSelect={setPeriodIndex}
                />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <GradientButton label="Save time" onPress={() => onConfirm(hasNativePicker ? selectedTime : fallbackSelectedTime)} />
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text className="text-base font-semibold text-brand-primary">Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalTitleBlock: {
    flex: 1,
    gap: 6,
    paddingRight: 12,
  },
  closeButton: {
    height: 38,
    width: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
  pickerShell: {
    backgroundColor: '#F5F7FB',
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E8F0',
  },
  nativePicker: {
    width: '100%',
    height: 220,
  },
  wheelsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  wheelShell: {
    position: 'relative',
    backgroundColor: '#F5F7FB',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    flex: 1,
  },
  wheelContent: {
    paddingVertical: ROW_HEIGHT * 1.25,
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    backgroundColor: '#ffffff',
    top: ROW_HEIGHT * 1.25,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E2F4',
    zIndex: 1,
  },
  wheelItem: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemActive: {
    transform: [{ scale: 1 }],
  },
  wheelText: {
    color: '#111827',
  },
  wheelTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  actions: {
    gap: 10,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
