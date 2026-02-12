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
import {
  LocationPickerSheet,
  type LocationPickerSelection,
} from "./LocationPickerSheet";

// Life areas with icons - same as AddEventTemplate
const EVENT_CATEGORY_TO_CORE_VALUE: Partial<Record<EventCategory, string>> = {
  routine: "faith",
  family: "family",
  work: "work",
  health: "health",
  finance: "finances",
  free: "personal-growth",
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const CORE_VALUE_TO_EVENT_CATEGORY: Partial<Record<string, EventCategory>> = {
  faith: "routine",
  family: "family",
  work: "work",
  health: "health",
  finances: "finance",
  "personal-growth": "free",
};

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
    valueLabel?: string | null;
    valueSubcategory?: string | null;
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
  const { coreValues, coreCategories, goals, initiatives } =
    useOnboardingStore();

  // Animated values for backdrop fade and panel slide
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(1000)).current;

  // Local draft state
  const [selectedCategory, setSelectedCategory] =
    useState<EventCategory>("work");
  const [isBig3, setIsBig3] = useState(false);
  const [selectedCoreValueId, setSelectedCoreValueId] = useState<string | null>(
    null,
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<
    string | null
  >(null);
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

  // Combine goals and initiatives
  const allGoals = [...goals, ...initiatives].filter(Boolean);

  const coreValueOptions = coreValues
    .filter((value) => value.isSelected)
    .map((value) => ({ id: value.id, label: value.label }));

  useEffect(() => {
    if (!visible || !event) return;
    const mappedId = EVENT_CATEGORY_TO_CORE_VALUE[event.category];
    const labelMatch =
      typeof event.meta?.value_label === "string"
        ? coreValueOptions.find(
            (value) =>
              normalizeLabel(value.label) ===
              normalizeLabel(event.meta?.value_label ?? ""),
          )
        : null;
    setSelectedCoreValueId(labelMatch?.id ?? mappedId ?? null);
  }, [coreValueOptions, event, visible]);

  useEffect(() => {
    if (!selectedCoreValueId) return;
    const mappedCategory =
      CORE_VALUE_TO_EVENT_CATEGORY[selectedCoreValueId] ?? null;
    if (mappedCategory && mappedCategory !== selectedCategory) {
      setSelectedCategory(mappedCategory);
    }
  }, [selectedCoreValueId, selectedCategory]);

  const coreSubcategoryOptions = coreCategories
    .filter((category) => category.valueId === selectedCoreValueId)
    .map((category) => ({ id: category.id, label: category.label }));

  useEffect(() => {
    if (!visible || !event) return;
    if (typeof event.meta?.value_subcategory !== "string") {
      setSelectedSubcategoryId(null);
      return;
    }
    const match = coreSubcategoryOptions.find(
      (subcategory) =>
        normalizeLabel(subcategory.label) ===
        normalizeLabel(event.meta?.value_subcategory ?? ""),
    );
    setSelectedSubcategoryId(match?.id ?? null);
  }, [coreSubcategoryOptions, event, visible]);

  if (!event) return null;

  const handleSave = () => {
    const startMins = startTime.getHours() * 60 + startTime.getMinutes();
    const endMins = endTime.getHours() * 60 + endTime.getMinutes();
    const duration = Math.max(endMins - startMins, 15);
    const valueLabel =
      coreValueOptions.find((value) => value.id === selectedCoreValueId)
        ?.label ?? null;
    const valueSubcategory =
      coreSubcategoryOptions.find(
        (subcategory) => subcategory.id === selectedSubcategoryId,
      )?.label ?? null;

    void onSave?.({
      title: title.trim(),
      location: location.trim(),
      category: selectedCategory,
      isBig3,
      startMinutes: startMins,
      duration: duration,
      valueLabel,
      valueSubcategory,
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

            {/* Core Values */}
            <View className="mt-8 px-6">
              <Text className="text-xs font-semibold tracking-wider text-[#94A3B8]">
                CORE VALUES
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {coreValueOptions.map((value) => {
                  const isSelected = selectedCoreValueId === value.id;
                  return (
                    <Pressable
                      key={value.id}
                      onPress={() => {
                        setSelectedCoreValueId(value.id);
                        setSelectedSubcategoryId(null);
                      }}
                      className={`rounded-full border px-4 py-2.5 ${
                        isSelected
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : "border-[#E2E8F0] bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? "text-[#2563EB]" : "text-[#64748B]"
                        }`}
                      >
                        {value.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Time Categories */}
            <View className="mt-8 px-6">
              <Text className="text-xs font-semibold tracking-wider text-[#94A3B8]">
                TIME CATEGORIES
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {!selectedCoreValueId && (
                  <Text className="text-sm text-[#94A3B8]">
                    Select a core value to see time categories
                  </Text>
                )}
                {selectedCoreValueId && coreSubcategoryOptions.length === 0 && (
                  <Text className="text-sm text-[#94A3B8]">
                    No time categories found
                  </Text>
                )}
                {selectedCoreValueId &&
                  coreSubcategoryOptions.map((subcategory) => {
                    const isSelected = selectedSubcategoryId === subcategory.id;
                    return (
                      <Pressable
                        key={subcategory.id}
                        onPress={() =>
                          setSelectedSubcategoryId(
                            isSelected ? null : subcategory.id,
                          )
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
                          {subcategory.label}
                        </Text>
                      </Pressable>
                    );
                  })}
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

      <LocationPickerSheet
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(selection: LocationPickerSelection) => {
          setLocation(selection.label);
          setShowLocationPicker(false);
        }}
        latitude={null}
        longitude={null}
        currentLabel={location}
      />
    </Modal>
  );
};
