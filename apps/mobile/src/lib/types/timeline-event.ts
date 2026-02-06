/**
 * Timeline Event types.
 *
 * A TimelineEvent represents a single row in the redesigned timeline feed.
 * All event sources (app sessions, emails, Slack messages, meetings, phone
 * calls, calendar events) are normalized into this shape for uniform rendering.
 */

import type { ScheduledEvent } from "@/stores";

// ============================================================================
// Event Kind
// ============================================================================

export type TimelineEventKind =
  | "app"
  | "email"
  | "slack_message"
  | "meeting"
  | "phone_call"
  | "sms"
  | "website"
  | "scheduled";

export type ProductivityFlag = "productive" | "neutral" | "unproductive";

// ============================================================================
// Timeline Event
// ============================================================================

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  /** Bold label displayed on the row (e.g., "App", "E-Mail", "Meeting"). */
  kindLabel: string;
  /** Primary detail: app name, subject, meeting title, contact name. */
  title: string;
  /** Secondary detail: "12 Recipients", "8 Attendees", channel name. */
  subtitle?: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  /** App category for icon coloring (work/social/entertainment/comms/utility). */
  appCategory?: string;
  /** Productivity flag — social/entertainment apps are "unproductive" (red). */
  productivity: ProductivityFlag;
  /** IDs of events that overlap in time with this one. */
  overlaps?: string[];
  /** Whether this event is before the current time. */
  isPast: boolean;
  /** For scheduled calendar events: the planned event data. */
  scheduledEvent?: ScheduledEvent;
  /** For past scheduled events: the corresponding actual event. */
  actualEvent?: ScheduledEvent;
  /** Parent location block ID. */
  blockId: string;
  /** Source summary IDs for feedback submission. */
  summaryIds: string[];
}

// ============================================================================
// Location Banner Colors
// ============================================================================

export interface LocationBannerColors {
  bg: string;
  text: string;
}

export const LOCATION_COLORS: Record<string, LocationBannerColors> = {
  home: { bg: "#3B82F6", text: "#FFFFFF" },
  work: { bg: "#7C3AED", text: "#FFFFFF" },
  travel: { bg: "#F97316", text: "#FFFFFF" },
  gym: { bg: "#22C55E", text: "#FFFFFF" },
  frequent: { bg: "#F59E0B", text: "#FFFFFF" },
  unknown: { bg: "#64748B", text: "#FFFFFF" },
};

// ============================================================================
// Event Row Icon Colors (bicolor tints per event kind)
// ============================================================================

export interface BicolorTint {
  dark: string;
  light: string;
  iconColor: string;
}

/** Default bicolor tints per event kind. */
export const EVENT_KIND_COLORS: Record<TimelineEventKind, BicolorTint> = {
  app: { dark: "#64748B", light: "#94A3B8", iconColor: "#FFFFFF" },
  email: { dark: "#DC2626", light: "#F87171", iconColor: "#FFFFFF" },
  slack_message: { dark: "#7C3AED", light: "#A78BFA", iconColor: "#FFFFFF" },
  meeting: { dark: "#2563EB", light: "#60A5FA", iconColor: "#FFFFFF" },
  phone_call: { dark: "#059669", light: "#34D399", iconColor: "#FFFFFF" },
  sms: { dark: "#059669", light: "#34D399", iconColor: "#FFFFFF" },
  website: { dark: "#64748B", light: "#94A3B8", iconColor: "#FFFFFF" },
  scheduled: { dark: "#6B7280", light: "#9CA3AF", iconColor: "#FFFFFF" },
};

/** Red bicolor tint for unproductive/distracting apps. */
export const UNPRODUCTIVE_TINT: BicolorTint = {
  dark: "#DC2626",
  light: "#F87171",
  iconColor: "#FFFFFF",
};
