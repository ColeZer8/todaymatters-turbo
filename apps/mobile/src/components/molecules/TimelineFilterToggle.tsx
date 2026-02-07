import { Pressable, Text, View, StyleSheet } from "react-native";

export type TimelineFilter = "actual" | "scheduled" | "both";

interface TimelineFilterToggleProps {
  value: TimelineFilter;
  onChange: (value: TimelineFilter) => void;
}

const OPTIONS: { label: string; value: TimelineFilter }[] = [
  { label: "Actual", value: "actual" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Both", value: "both" },
];

export const TimelineFilterToggle = ({
  value,
  onChange,
}: TimelineFilterToggleProps) => {
  return (
    <View style={styles.track} accessibilityLabel="Timeline filter">
      {OPTIONS.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(option.value)}
            style={[styles.pill, isActive && styles.pillActive]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 2,
  },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  labelActive: {
    color: "#111827",
  },
});
