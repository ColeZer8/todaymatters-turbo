import type { EvidenceBundle } from "@/lib/supabase/services/evidence-data";
import type { ScheduledEvent } from "@/stores";
import type { TimeBlock } from "@/stores/review-time-store";
import { getReadableAppName } from "@/lib/app-names";

interface BuildReviewTimeBlocksInput {
  ymd: string;
  evidence: EvidenceBundle;
  actualEvents: ScheduledEvent[];
}

const MIN_SESSION_GAP_MINUTES = 15;

export function buildReviewTimeBlocks({
  ymd,
  evidence,
  actualEvents,
}: BuildReviewTimeBlocksInput): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const dayStart = ymdToDate(ymd);

  const actualEventsByOverlap = actualEvents.map((event) => ({
    event,
    start: event.startMinutes,
    end: event.startMinutes + event.duration,
  }));

  const locationBlocks = buildLocationBlocks(dayStart, evidence);
  const screenTimeBlocks = buildScreenTimeBlocks(dayStart, evidence);
  const workoutBlocks = buildWorkoutBlocks(dayStart, evidence);

  const candidateBlocks = [
    ...locationBlocks,
    ...screenTimeBlocks,
    ...workoutBlocks,
  ];
  const remainingUnknownEvents = new Map<string, ScheduledEvent>(
    actualEvents.filter((e) => e.category === "unknown").map((e) => [e.id, e]),
  );

  for (const block of candidateBlocks) {
    const overlap = findOverlappingEvent(block, actualEventsByOverlap);
    if (!overlap) {
      blocks.push(block);
      continue;
    }

    if (overlap.category !== "unknown") {
      continue;
    }

    remainingUnknownEvents.delete(overlap.id);
    blocks.push({
      ...block,
      eventId: overlap.id,
      title: overlap.title || block.title,
      description: overlap.description || block.description,
    });
  }

  for (const event of remainingUnknownEvents.values()) {
    blocks.push({
      id: `unknown_${event.id}`,
      sourceId: `unknown:${event.id}`,
      source: "unknown",
      eventId: event.id,
      title: event.title || "Unknown",
      description: event.description || "",
      duration: event.duration,
      startMinutes: event.startMinutes,
      startTime: formatMinutesToTime(event.startMinutes),
      endTime: formatMinutesToTime(event.startMinutes + event.duration),
      activityDetected: "No activity detected",
    });
  }

  return blocks.sort((a, b) => a.startMinutes - b.startMinutes);
}

function buildLocationBlocks(
  dayStart: Date,
  evidence: EvidenceBundle,
): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  const sorted = [...evidence.locationHourly].sort((a, b) =>
    a.hour_start.localeCompare(b.hour_start),
  );

  let current: TimeBlock | null = null;
  for (const loc of sorted) {
    const hourStart = new Date(loc.hour_start);
    const startMinutes = Math.floor(
      (hourStart.getTime() - dayStart.getTime()) / 60_000,
    );
    if (startMinutes < 0 || startMinutes >= 24 * 60) continue;

    const locationLabel =
      loc.place_label || loc.place_category || "Unknown location";
    const nextStart = startMinutes;
    const nextEnd = startMinutes + 60;
    const key = locationLabel.toLowerCase();

    if (
      current &&
      current.location?.toLowerCase() === key &&
      current.startMinutes + current.duration === nextStart
    ) {
      current.duration += 60;
      current.endTime = formatMinutesToTime(nextEnd);
      continue;
    }

    current = {
      id: `loc_${loc.hour_start}`,
      sourceId: `location:${loc.hour_start}`,
      source: "location",
      title: locationLabel,
      description: loc.place_category ?? "",
      duration: 60,
      startMinutes: nextStart,
      startTime: formatMinutesToTime(nextStart),
      endTime: formatMinutesToTime(nextEnd),
      location: locationLabel,
    };
    blocks.push(current);
  }

  return blocks;
}

function buildScreenTimeBlocks(
  dayStart: Date,
  evidence: EvidenceBundle,
): TimeBlock[] {
  const sessions = [...evidence.screenTimeSessions].sort((a, b) =>
    a.started_at.localeCompare(b.started_at),
  );
  if (sessions.length === 0) return [];

  const blocks: TimeBlock[] = [];
  let currentStart = 0;
  let currentEnd = 0;
  let currentPickups = 0;
  const appUsage = new Map<string, number>();

  const flush = () => {
    if (currentEnd <= currentStart) return;
    const duration = currentEnd - currentStart;
    const topApp = getTopApp(appUsage);
    const activityDetected =
      currentPickups > 0
        ? `Phone unlocked ${currentPickups} times`
        : `Screen time${topApp ? `: ${topApp}` : ""}`;
    blocks.push({
      id: `screen_${currentStart}_${currentEnd}`,
      sourceId: `screen:${currentStart}:${currentEnd}`,
      source: "screen_time",
      title: "Screen Time",
      description: topApp ? `Top app: ${topApp}` : "",
      duration,
      startMinutes: currentStart,
      startTime: formatMinutesToTime(currentStart),
      endTime: formatMinutesToTime(currentEnd),
      activityDetected,
    });
  };

  for (const session of sessions) {
    const startedAt = new Date(session.started_at);
    const endedAt = new Date(session.ended_at);
    const startMinutes = Math.floor(
      (startedAt.getTime() - dayStart.getTime()) / 60_000,
    );
    const endMinutes = Math.ceil(
      (endedAt.getTime() - dayStart.getTime()) / 60_000,
    );
    if (endMinutes <= 0 || startMinutes >= 24 * 60) continue;

    const safeStart = Math.max(0, startMinutes);
    const safeEnd = Math.min(24 * 60, endMinutes);

    if (currentEnd > 0 && safeStart - currentEnd > MIN_SESSION_GAP_MINUTES) {
      flush();
      currentStart = safeStart;
      currentEnd = safeEnd;
      currentPickups = 0;
      appUsage.clear();
    } else if (currentEnd === 0) {
      currentStart = safeStart;
      currentEnd = safeEnd;
    } else {
      currentEnd = Math.max(currentEnd, safeEnd);
    }

    currentPickups += session.pickups ?? 0;
    const appName =
      getReadableAppName({
        appId: session.app_id,
        displayName: session.display_name,
      }) ?? session.app_id;
    const currentUsage = appUsage.get(appName) ?? 0;
    appUsage.set(appName, currentUsage + session.duration_seconds / 60);
  }

  flush();
  return blocks;
}

function buildWorkoutBlocks(
  dayStart: Date,
  evidence: EvidenceBundle,
): TimeBlock[] {
  return evidence.healthWorkouts.map((workout) => {
    const start = new Date(workout.started_at);
    const end = new Date(workout.ended_at);
    const startMinutes = Math.floor(
      (start.getTime() - dayStart.getTime()) / 60_000,
    );
    const endMinutes = Math.ceil((end.getTime() - dayStart.getTime()) / 60_000);
    const duration = Math.max(1, endMinutes - startMinutes);
    const activity = workout.activity_type || "Workout";
    return {
      id: `workout_${workout.id}`,
      sourceId: `workout:${workout.id}`,
      source: "workout",
      title: activity,
      description: `${Math.round(workout.duration_seconds / 60)} min`,
      duration,
      startMinutes: Math.max(0, startMinutes),
      startTime: formatMinutesToTime(Math.max(0, startMinutes)),
      endTime: formatMinutesToTime(Math.min(24 * 60, endMinutes)),
      activityDetected: activity,
    };
  });
}

function findOverlappingEvent(
  block: TimeBlock,
  events: Array<{ event: ScheduledEvent; start: number; end: number }>,
): ScheduledEvent | null {
  const blockStart = block.startMinutes;
  const blockEnd = block.startMinutes + block.duration;
  for (const entry of events) {
    const overlapStart = Math.max(blockStart, entry.start);
    const overlapEnd = Math.min(blockEnd, entry.end);
    if (overlapEnd > overlapStart) {
      return entry.event;
    }
  }
  return null;
}

function getTopApp(appUsage: Map<string, number>): string | null {
  let top: string | null = null;
  let max = 0;
  for (const [app, minutes] of appUsage.entries()) {
    if (minutes > max) {
      max = minutes;
      top = app;
    }
  }
  return top;
}

function formatMinutesToTime(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function ymdToDate(ymd: string): Date {
  const match = ymd.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(year, month, day, 0, 0, 0, 0);
}
