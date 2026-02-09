/**
 * Communication Events Service
 *
 * Fetches emails, Slack messages, phone calls, and SMS for a given day
 * from the tm.events table. Used by the timeline feed to show communication
 * events alongside app usage in chronological order.
 */

import { supabase } from "../client";
import { handleSupabaseError } from "../utils/error-handler";
import type { Database } from "../database.types";

export type TmEventRow = Database["tm"]["Tables"]["events"]["Row"];

const COMM_EVENT_TYPES = [
  "email",
  "slack_message",
  "phone_call",
  "sms",
  "meeting",
] as const;

/**
 * Fetch communication events (email, slack, phone, sms, meeting) for a day.
 *
 * Queries tm.events filtered by type and scheduled_start within the given
 * day window. Falls back to created_at if scheduled_start is missing.
 */
export async function fetchCommunicationEventsForDay(
  userId: string,
  ymd: string,
): Promise<TmEventRow[]> {
  // Build day boundaries in local time
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const dayStart = new Date(year, month, day, 0, 0, 0);
  const dayEnd = new Date(year, month, day + 1, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();

  try {
    const { data, error } = await supabase
      .schema("tm")
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .in("type", [...COMM_EVENT_TYPES])
      .or(
        `sent_at.gte.${dayStartIso},received_at.gte.${dayStartIso},scheduled_start.gte.${dayStartIso},created_at.gte.${dayStartIso}`,
      )
      .or(
        `sent_at.lt.${dayEndIso},received_at.lt.${dayEndIso},scheduled_start.lt.${dayEndIso},created_at.lt.${dayEndIso}`,
      )
      .order("sent_at", { ascending: true, nullsFirst: true })
      .limit(200);

    if (error) throw handleSupabaseError(error);

    // Filter out all-day / multi-day events (holidays, etc.) that leak in
    // through the 'meeting' type. Real meetings don't span 23+ hours.
    const ALL_DAY_MS = 23 * 60 * 60_000;
    const filtered = ((data ?? []) as TmEventRow[]).filter((row) => {
      if (!row.scheduled_start || !row.scheduled_end) return true;
      const startMs = new Date(row.scheduled_start).getTime();
      const endMs = new Date(row.scheduled_end).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) return true;
      return endMs - startMs < ALL_DAY_MS;
    });

    return filtered;
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[communication-events] Failed to fetch communication events:",
        err,
      );
    }
    return [];
  }
}
