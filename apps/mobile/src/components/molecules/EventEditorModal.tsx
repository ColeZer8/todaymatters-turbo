import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  Flag,
  Calendar,
  Clock,
  Sun,
  Heart,
  Briefcase,
  Dumbbell,
  Check,
} from "lucide-react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Icon } from "../atoms/Icon";
import { useOnboardingStore } from "@/stores";
import type { ScheduledEvent, EventCategory } from "@/stores";
import { LocationSearchModal } from "./LocationSearchModal";

// Life areas with icons - same as AddEventTemplate
const LIFE_AREAS: Array<{
  id: EventCategory;
  label: string;
  icon: typeof Sun;
}> = [
  { id: "routine", label: "Faith", icon: Sun },
  { id: "family", label: "Family", icon: Heart },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "health", label: "Health", icon: Dumbbell },
];

const formatDateFull = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (date: Date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const combineDateAndTime = (date: Date, time: Date) => {
  const next = new Date(date);
  next.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return next;
};

interface EventEditorModalProps {
  event: ScheduledEvent | null;
  visible: boolean;
  onClose: () => void;
  onSave?: (updates: {
    title?: string;
    location?: string;
    category?: EventCategory;
    isBig3?: boolean;
    startMinutes?: number;
    duration?: number;
  }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

export const EventEditorModal = ({
  event,
  visible,
  onClose,
  onSave,
  onDelete,
}: EventEditorModalProps) => {
  const insets = useSafeAreaInsets();
  const { joySelections, goals, initiatives } = useOnboardingStore();

  // Animated values for backdrop fade and panel slide
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;

  // Local draft state
  const [selectedCategory, setSelectedCategory] =
    useState<EventCategory>("work");
  const [isBig3, setIsBig3] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");

  // Time/Date state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  // Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [allDay, setAllDay] = useState(false);

  useEffect(() => {
    if (visible && event) {
      // Initialize state from event
      setSelectedCategory(event.category || "work");
      setIsBig3(event.isBig3 || false);
      setTitle(event.title || "");
      setLocation(event.location || "");

      // Assume today for simplicity or parse from event context if available
      // Since ScheduledEvent only has startMinutes, we use today's date
      const today = new Date();
      setSelectedDate(today);

      const start = new Date(today);
      start.setHours(
        Math.floor(event.startMinutes / 60),
        event.startMinutes % 60,
        0,
        0,
      );
      setStartTime(start);

      const end = new Date(today);
      const endMinutes = event.startMinutes + event.duration;
      end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      setEndTime(end);

      // Run animations
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(panelTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      panelTranslateY.setValue(1000);
      setShowDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    }
  }, [visible, event, backdropOpacity, panelTranslateY]);

  // Combine joy selections as "values" - use defaults if empty
  const values =
    joySelections.length > 0
      ? joySelections
      : ["Family", "Integrity", "Creativity"];

  // Combine goals and initiatives
  const allGoals = [...goals, ...initiatives].filter(Boolean);

  if (!event) return null;

  const handleSave = () => {
    const startMins = startTime.getHours() * 60 + startTime.getMinutes();
    const endMins = endTime.getHours() * 60 + endTime.getMinutes();
    const duration = Math.max(endMins - startMins, 15);

    void onSave?.({
      title: title.trim(),
      location: location.trim(),
      category: selectedCategory,
      isBig3,
      startMinutes: startMins,
      duration: duration,
    });
  };

  const openAndroidDatePicker = () => {
    DateTimePickerAndroid.open({
      value: selectedDate,
      mode: "date",
      onChange: (ev, date) => {
        if (ev.type !== "set" || !date) return;
        setSelectedDate(date);
        setStartTime((prev) => combineDateAndTime(date, prev));
        setEndTime((prev) => combineDateAndTime(date, prev));
      },
    });
  };

  const openAndroidStartTimePicker = () => {
    DateTimePickerAndroid.open({
      value: startTime,
      mode: "time",
      onChange: (ev, date) => {
        if (ev.type !== "set" || !date) return;
        setStartTime(combineDateAndTime(selectedDate, date));
      },
    });
  };

  const openAndroidEndTimePicker = () => {
    DateTimePickerAndroid.open({
      value: endTime,
      mode: "time",
      onChange: (ev, date) => {
        if (ev.type !== "set" || !date) return;
        setEndTime(combineDateAndTime(selectedDate, date));
      },
    });
  };

  const onDateChange = (ev: DateTimePickerEvent, date?: Date) => {
    // iOS: inline picker stays mounted; apply changes as user scrolls.
    if (date) {
      setSelectedDate(date);
      setStartTime((prev) => combineDateAndTime(date, prev));
      setEndTime((prev) => combineDateAndTime(date, prev));
    }
  };

  const onStartTimeChange = (ev: DateTimePickerEvent, date?: Date) => {
    // iOS: inline picker updates time continuously
    if (date) setStartTime(combineDateAndTime(selectedDate, date));
  };

  const onEndTimeChange = (ev: DateTimePickerEvent, date?: Date) => {
    // iOS: inline picker updates time continuously
    if (date) setEndTime(combineDateAndTime(selectedDate, date));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* Animated backdrop */}
        <Animated.View
          className="absolute inset-0 bg-black/40"
          style={{ opacity: backdropOpacity }}
        />

        {/* Panel */}
        <Animated.View
          className="bg-[#F2F2F7] rounded-t-3xl"
          style={{
            height: "92%",
            transform: [{ translateY: panelTranslateY }],
            // Add top padding for safe area on Android to prevent status bar overlap
            paddingTop: Platform.OS === "android" ? insets.top : 0,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Pressable onPress={onClose}>
              <Text className="text-lg text-[#2563EB]">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-bold text-[#111827]">Edit Event</Text>
            <Pressable onPress={handleSave}>
              <Text className="text-lg font-bold text-[#2563EB]">Done</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          >
            {/* Title & Location Section */}
            <View className="mt-4 mx-4 overflow-hidden rounded-xl bg-white">
              <View className="px-4 py-3">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Title"
                  placeholderTextColor="#94A3B8"
                  className="text-lg text-[#111827]"
                />
              </View>
              <View className="h-[1px] ml-4 bg-[#E5E5EA]" />
              <Pressable
                onPress={() => setShowLocationPicker(true)}
                className="px-4 py-3"
              >
                <Text
                  className={`text-lg ${location ? "text-[#111827]" : "text-[#94A3B8]"}`}
                >
                  {location || "Location or Video Call"}
                </Text>
              </Pressable>
            </View>

            {/* Time & Date Section */}
            <View className="mt-8 mx-4 overflow-hidden rounded-xl bg-white">
              <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="text-lg text-[#111827]">All-day</Text>
                <Switch
                  value={allDay}
                  onValueChange={setAllDay}
                  trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                />
              </View>
              <View className="h-[1px] ml-4 bg-[#E5E5EA]" />

              <Pressable
                onPress={() => {
                  if (Platform.OS === "android") {
                    openAndroidDatePicker();
                    return;
                  }
                  setShowDatePicker(!showDatePicker);
                  setShowStartTimePicker(false);
                  setShowEndTimePicker(false);
                }}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <Text className="text-lg text-[#111827]">Starts</Text>
                <View className="flex-row items-center gap-2">
                  <View className="rounded-lg bg-[#E5E5EA] px-2 py-1">
                    <Text className="text-lg text-[#111827]">
                      {formatDateFull(selectedDate)}
                    </Text>
                  </View>
                  {!allDay && (
                    <Pressable
                      onPress={() => {
                        if (Platform.OS === "android") {
                          openAndroidStartTimePicker();
                          return;
                        }
                        setShowStartTimePicker(!showStartTimePicker);
                        setShowDatePicker(false);
                        setShowEndTimePicker(false);
                      }}
                    >
                      <View className="rounded-lg bg-[#E5E5EA] px-2 py-1">
                        <Text
                          className={`text-lg ${showStartTimePicker ? "text-[#EF4444]" : "text-[#111827]"}`}
                        >
                          {formatTime(startTime)}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </Pressable>

              {showDatePicker && Platform.OS === "ios" && (
                <View className="bg-white px-4 pb-4">
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onDateChange}
                    themeVariant="light"
                  />
                </View>
              )}

              {/* Inline Start Time Picker (iOS) */}
              {showStartTimePicker && !allDay && Platform.OS === "ios" && (
                <View className="bg-white">
                  <View className="h-[1px] bg-[#E5E5EA]" />
                  <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="spinner"
                    onChange={onStartTimeChange}
                    themeVariant="light"
                    style={{ height: 200 }}
                  />
                </View>
              )}

              <View className="h-[1px] ml-4 bg-[#E5E5EA]" />

              {!allDay && (
                <>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === "android") {
                        openAndroidEndTimePicker();
                        return;
                      }
                      setShowEndTimePicker(!showEndTimePicker);
                      setShowDatePicker(false);
                      setShowStartTimePicker(false);
                    }}
                    className="flex-row items-center justify-between px-4 py-3"
                  >
                    <Text className="text-lg text-[#111827]">Ends</Text>
                    <View className="rounded-lg bg-[#E5E5EA] px-2 py-1">
                      <Text
                        className={`text-lg ${showEndTimePicker ? "text-[#EF4444]" : "text-[#111827]"}`}
                      >
                        {formatTime(endTime)}
                      </Text>
                    </View>
                  </Pressable>
                  {/* End time picker - iOS inline */}
                  {showEndTimePicker && Platform.OS === "ios" && (
                    <View className="bg-white">
                      <View className="h-[1px] bg-[#E5E5EA]" />
                      <DateTimePicker
                        value={endTime}
                        mode="time"
                        display="spinner"
                        onChange={onEndTimeChange}
                        themeVariant="light"
                        style={{ height: 200 }}
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Big 3 Section */}
            <View className="mt-8 mx-4 overflow-hidden rounded-xl bg-white">
              <Pressable
                onPress={() => setIsBig3(!isBig3)}
                className="flex-row items-center justify-between px-4 py-3"
              >
                <View className="flex-row items-center gap-3">
                  <Icon
                    icon={Flag}
                    size={20}
                    color={isBig3 ? "#F59E0B" : "#8E8E93"}
                  />
                  <Text className="text-lg text-[#111827]">Mark as Big 3</Text>
                </View>
                <Switch
                  value={isBig3}
                  onValueChange={setIsBig3}
                  trackColor={{ false: "#D1D1D6", true: "#34C759" }}
                />
              </Pressable>
            </View>

            {/* Life Area */}
            <View className="mt-8 px-6">
              <Text className="text-xs font-semibold tracking-wider text-[#F97316]">
                LIFE AREA
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {LIFE_AREAS.map((area) => {
                  const isSelected = selectedCategory === area.id;
                  return (
                    <Pressable
                      key={area.id}
                      onPress={() => setSelectedCategory(area.id)}
                      className={`flex-row items-center gap-2 rounded-full border px-4 py-2.5 ${
                        isSelected
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : "border-[#E2E8F0] bg-white"
                      }`}
                    >
                      <Icon
                        icon={area.icon}
                        size={16}
                        color={isSelected ? "#2563EB" : "#94A3B8"}
                      />
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? "text-[#2563EB]" : "text-[#64748B]"
                        }`}
                      >
                        {area.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Align with Values */}
            <View className="mt-8 px-6">
              <Text className="text-xs font-semibold tracking-wider text-[#94A3B8]">
                ALIGN WITH VALUES
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {values.slice(0, 4).map((value) => {
                  const isSelected = selectedValue === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() =>
                        setSelectedValue(isSelected ? null : value)
                      }
                      className={`rounded-full border px-4 py-2.5 ${
                        isSelected
                          ? "border-[#1E293B] bg-[#1E293B]"
                          : "border-[#E2E8F0] bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? "text-white" : "text-[#64748B]"
                        }`}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable className="rounded-full border border-dashed border-[#CBD5E1] px-4 py-2.5">
                  <Text className="text-sm font-semibold text-[#94A3B8]">
                    + Add
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Delete Button */}
            <Pressable
              onPress={() => {
                void onDelete?.();
                onClose();
              }}
              className="mt-8 mx-6 items-center justify-center rounded-xl bg-white py-4 border border-[#E5E5EA]"
            >
              <Text className="text-lg font-semibold text-[#EF4444]">
                Delete Event
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>

      <LocationSearchModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={setLocation}
        currentLocation={location}
      />
    </Modal>
  );
};
