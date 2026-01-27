import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "../atoms/Icon";
import { MessageSquare, Mail, Hash, LucideIcon } from "lucide-react-native";

export type CommunicationSource = "sms" | "outlook" | "gmail" | "slack";

interface CommunicationItemProps {
  name: string;
  message: string;
  time: string;
  receivedAt?: string;
  unread?: boolean;
  initials: string;
  source: CommunicationSource;
  channel?: string; // For Slack channel name
  onPress?: () => void;
  onMarkRead?: () => void;
}

// Source configuration for icons and colors
const SOURCE_CONFIG: Record<
  CommunicationSource,
  {
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  sms: {
    icon: MessageSquare,
    color: "#10B981",
    bgColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.2)",
    label: "Text",
  },
  outlook: {
    icon: Mail,
    color: "#0078D4",
    bgColor: "rgba(0, 120, 212, 0.1)",
    borderColor: "rgba(0, 120, 212, 0.2)",
    label: "Outlook",
  },
  gmail: {
    icon: Mail,
    color: "#EA4335",
    bgColor: "rgba(234, 67, 53, 0.1)",
    borderColor: "rgba(234, 67, 53, 0.2)",
    label: "Gmail",
  },
  slack: {
    icon: Hash,
    color: "#611f69",
    bgColor: "rgba(97, 31, 105, 0.1)",
    borderColor: "rgba(97, 31, 105, 0.2)",
    label: "Slack",
  },
};

export const CommunicationItem = ({
  name,
  message,
  time,
  receivedAt,
  unread = false,
  initials,
  source,
  channel,
  onPress,
  onMarkRead,
}: CommunicationItemProps) => {
  const config = SOURCE_CONFIG[source];

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      activeOpacity={0.7}
    >
      {/* Left side - Avatar with source indicator */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {/* Source indicator badge */}
        <View
          style={[
            styles.sourceBadge,
            {
              backgroundColor: config.bgColor,
              borderColor: config.borderColor,
            },
          ]}
        >
          <Icon icon={config.icon} size={10} color={config.color} />
        </View>
        {/* Unread indicator */}
        {unread && <View style={styles.unreadDot} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.nameContainer}>
            <Text
              style={[styles.name, unread && styles.nameUnread]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {channel && <Text style={styles.channel}>#{channel}</Text>}
          </View>
          <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text>
        </View>
        <Text
          style={[styles.message, unread && styles.messageUnread]}
          numberOfLines={2}
        >
          {message}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.receivedAt} numberOfLines={1}>
            {receivedAt}
          </Text>
          {unread && onMarkRead && (
            <TouchableOpacity
              onPress={onMarkRead}
              style={styles.markReadButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Mark as read"
            >
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
  },
  sourceBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#F7FAFF",
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    flexShrink: 1,
  },
  nameUnread: {
    fontWeight: "700",
    color: "#111827",
  },
  channel: {
    fontSize: 13,
    color: "#9CA3AF",
    marginLeft: 6,
  },
  time: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  timeUnread: {
    fontWeight: "600",
    color: "#2563EB",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
  },
  messageUnread: {
    color: "#4B5563",
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  receivedAt: {
    fontSize: 12,
    color: "#94A3B8",
    flex: 1,
  },
  markReadButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    backgroundColor: "#EEF2FF",
  },
  markReadText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3730A3",
  },
});
