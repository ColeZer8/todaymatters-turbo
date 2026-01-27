import { View, Text, StyleSheet } from "react-native";
import { Icon } from "../atoms/Icon";
import { LucideIcon } from "lucide-react-native";

interface ScheduleItemProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  timeOrStatus: string;
  isPrimary?: boolean;
}

export const ScheduleItem = ({
  icon,
  title,
  subtitle,
  timeOrStatus,
  isPrimary = false,
}: ScheduleItemProps) => {
  return (
    <View style={[styles.container, !isPrimary && styles.containerSecondary]}>
      <View
        style={
          isPrimary ? styles.iconCirclePrimary : styles.iconCircleSecondary
        }
      >
        <Icon
          icon={icon}
          size={20}
          color={isPrimary ? "#FFFFFF" : "#9CA3AF"}
          style={!isPrimary ? styles.iconSecondary : undefined}
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={isPrimary ? styles.titlePrimary : styles.titleSecondary}>
          {title}
        </Text>
        <Text
          style={isPrimary ? styles.subtitlePrimary : styles.subtitleSecondary}
        >
          {subtitle}
        </Text>
      </View>

      <Text style={isPrimary ? styles.metaPrimary : styles.metaSecondary}>
        {timeOrStatus}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
  },
  containerSecondary: {
    opacity: 0.68,
  },
  iconCirclePrimary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  iconCircleSecondary: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.06)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
  },
  iconSecondary: {
    opacity: 0.48,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  titlePrimary: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  subtitlePrimary: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 3,
  },
  titleSecondary: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9DA7B7",
  },
  subtitleSecondary: {
    fontSize: 13,
    color: "#BCC6D3",
    marginTop: 3,
  },
  metaPrimary: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    paddingTop: 4,
  },
  metaSecondary: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A7B0BE",
    paddingTop: 4,
  },
});
