import { View, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DateNavigator } from "../molecules/DateNavigator";
import { CalendarEventItem } from "../molecules/CalendarEventItem";
import { FloatingActionButton } from "../atoms/FloatingActionButton";
import { BottomToolbar } from "../organisms/BottomToolbar";
import {
  Sun,
  Target,
  Coffee,
  Users,
  Video,
  Smile,
  Heart,
  Moon,
  Briefcase,
  Car,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEventsStore, formatMinutesToDisplay } from "@/stores";
import type { EventCategory } from "@/stores";

// Map categories to icons and colors
const CATEGORY_CONFIG: Record<
  EventCategory,
  { icon: LucideIcon; bgColor: string; iconColor: string }
> = {
  routine: { icon: Sun, bgColor: "bg-blue-100", iconColor: "#3B82F6" },
  work: { icon: Target, bgColor: "bg-gray-100", iconColor: "#6B7280" },
  meal: { icon: Coffee, bgColor: "bg-orange-100", iconColor: "#F97316" },
  meeting: { icon: Users, bgColor: "bg-purple-100", iconColor: "#A855F7" },
  health: { icon: Heart, bgColor: "bg-green-100", iconColor: "#10B981" },
  family: { icon: Heart, bgColor: "bg-pink-100", iconColor: "#EC4899" },
  social: { icon: Users, bgColor: "bg-purple-100", iconColor: "#A855F7" },
  travel: { icon: Car, bgColor: "bg-yellow-100", iconColor: "#F59E0B" },
  finance: { icon: Briefcase, bgColor: "bg-green-100", iconColor: "#10B981" },
  comm: { icon: Video, bgColor: "bg-gray-100", iconColor: "#6B7280" },
  digital: { icon: Video, bgColor: "bg-blue-100", iconColor: "#3B82F6" },
  sleep: { icon: Moon, bgColor: "bg-indigo-100", iconColor: "#6366F1" },
  unknown: { icon: Target, bgColor: "bg-gray-100", iconColor: "#9CA3AF" },
  free: { icon: Smile, bgColor: "bg-green-100", iconColor: "#10B981" },
};

export const CalendarTemplate = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheduledEvents = useEventsStore((state) => state.scheduledEvents);

  // Filter out sleep events and map to display format
  const displayEvents = scheduledEvents
    .filter((e) => e.category !== "sleep")
    .map((event) => {
      const config = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.routine;
      return {
        id: event.id,
        icon: config.icon,
        title: event.title,
        subtitle: event.description,
        time: formatMinutesToDisplay(event.startMinutes),
        iconBgColor: config.bgColor,
        iconColor: config.iconColor,
      };
    });

  const handleAddEvent = () => {
    router.push("/add-event");
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top - 11, 0) }]}>
      <DateNavigator date="Friday, Nov 8" />

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {displayEvents.map((event) => (
          <CalendarEventItem
            key={event.id}
            icon={event.icon}
            title={event.title}
            subtitle={event.subtitle}
            time={event.time}
            iconBgColor={event.iconBgColor}
            iconColor={event.iconColor}
          />
        ))}
      </ScrollView>

      <FloatingActionButton
        bottomOffset={insets.bottom + 82}
        onPress={handleAddEvent}
      />
      <BottomToolbar />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFF",
  },
});
