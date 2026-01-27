import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "../atoms/Icon";
import { LucideIcon, ChevronRight } from "lucide-react-native";

interface ActionItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onPress?: () => void;
}

export const ActionItem = ({
  icon,
  title,
  description,
  onPress,
}: ActionItemProps) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.iconContainer}>
        <Icon icon={icon} size={20} color="#EF4444" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <Icon
        icon={ChevronRight}
        size={20}
        color="#9CA3AF"
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  description: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    maxWidth: "90%",
  },
  chevron: {
    marginLeft: "auto",
    opacity: 0.6,
  },
});
