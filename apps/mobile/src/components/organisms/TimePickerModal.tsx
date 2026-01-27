import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { X } from "lucide-react-native";
import { GradientButton, Icon } from "../atoms";

interface TimePickerModalProps {
  visible: boolean;
  label: string;
  initialTime: Date;
  onConfirm: (time: Date) => void;
  onClose: () => void;
}

type ColumnType = "hour" | "minute" | "period";

const HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);
const PERIODS = ["AM", "PM"];
const ROW_HEIGHT = 46;

const getInitialIndex = (type: ColumnType, date: Date) => {
  if (type === "hour") {
    const hour = date.getHours();
    const normalized = hour % 12 || 12;
    return HOURS.indexOf(String(normalized).padStart(2, "0"));
  }
  if (type === "minute") {
    const minute = date.getMinutes();
    const rounded = Math.round(minute / 5) * 5;
    const safe = rounded >= 60 ? 0 : rounded;
    return MINUTES.indexOf(String(safe).padStart(2, "0"));
  }
  return date.getHours() >= 12 ? 1 : 0;
};

const toDate = (
  hourIndex: number,
  minuteIndex: number,
  periodIndex: number,
) => {
  const hourValue = hourIndex + 1;
  const minuteValue = minuteIndex * 5;
  const isPM = periodIndex === 1;
  const hour24 = (hourValue % 12) + (isPM ? 12 : 0);
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

const WheelColumn = ({
  type,
  data,
  selectedIndex,
  onSelect,
}: WheelColumnProps) => {
  const columnLabel =
    type === "hour" ? "Hour" : type === "minute" ? "Minute" : "Period";

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offset = event.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ROW_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  };

  return (
    <View style={styles.column}>
      <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {columnLabel}
      </Text>
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
              <View
                style={[styles.wheelItem, isActive && styles.wheelItemActive]}
              >
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
  const isAndroid = Platform.OS === "android";
  const isIOS = Platform.OS === "ios";

  const [selectedTime, setSelectedTime] = useState(initialTime);
  const [hourIndex, setHourIndex] = useState(() =>
    getInitialIndex("hour", initialTime),
  );
  const [minuteIndex, setMinuteIndex] = useState(() =>
    getInitialIndex("minute", initialTime),
  );
  const [periodIndex, setPeriodIndex] = useState(() =>
    getInitialIndex("period", initialTime),
  );

  useEffect(() => {
    if (visible) {
      setSelectedTime(initialTime);
      setHourIndex(getInitialIndex("hour", initialTime));
      setMinuteIndex(getInitialIndex("minute", initialTime));
      setPeriodIndex(getInitialIndex("period", initialTime));
    }
  }, [initialTime, visible]);

  // iOS: Update selected time as user scrolls
  const handleIOSChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setSelectedTime(date);
    }
  };

  // Android: Handle the native dialog result (set or dismissed)
  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    // Android picker auto-closes, so we need to handle both cases
    if (event.type === "set" && date) {
      // User pressed OK
      onConfirm(date);
    } else if (event.type === "dismissed") {
      // User pressed Cancel or tapped outside
      onClose();
    }
  };

  const fallbackSelectedTime = useMemo(
    () => toDate(hourIndex, minuteIndex, periodIndex),
    [hourIndex, minuteIndex, periodIndex],
  );

  // Android: Show native time picker dialog directly (no custom modal wrapper)
  if (isAndroid && visible) {
    return (
      <DateTimePicker
        value={initialTime}
        mode="time"
        display="spinner"
        onChange={handleAndroidChange}
        minuteInterval={5}
        positiveButton={{ label: "Confirm", textColor: "#2563EB" }}
        negativeButton={{ label: "Cancel", textColor: "#64748b" }}
      />
    );
  }

  // iOS & Web: Show our custom modal with inline picker
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
          {/* Close button - top right corner */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <Icon icon={X} size={16} color="#64748b" />
          </Pressable>

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.subtitle}>
              Choose a time that matches your everyday rhythm.
            </Text>
          </View>

          {/* Time Picker */}
          <View style={styles.pickerContainer}>
            {isIOS ? (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={handleIOSChange}
                minuteInterval={5}
                themeVariant="light"
                style={styles.nativePicker}
              />
            ) : (
              // Web fallback - custom wheel picker
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

          {/* Confirm Button */}
          <GradientButton
            label="Confirm"
            onPress={() =>
              onConfirm(isIOS ? selectedTime : fallbackSelectedTime)
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 24,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonPressed: {
    backgroundColor: "#e2e8f0",
  },
  modalHeader: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    textAlign: "center",
  },
  pickerContainer: {
    backgroundColor: "#f8fafc",
    borderRadius: 24,
    marginBottom: 20,
    overflow: "hidden",
  },
  nativePicker: {
    width: "100%",
    height: 200,
  },
  wheelsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 4,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  wheelShell: {
    position: "relative",
    backgroundColor: "#F5F7FB",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4E8F0",
    flex: 1,
  },
  wheelContent: {
    paddingVertical: ROW_HEIGHT * 1.25,
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    backgroundColor: "#ffffff",
    top: ROW_HEIGHT * 1.25,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E2F4",
    zIndex: 1,
  },
  wheelItem: {
    height: ROW_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelItemActive: {
    transform: [{ scale: 1 }],
  },
  wheelText: {
    color: "#111827",
  },
  wheelTextActive: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
