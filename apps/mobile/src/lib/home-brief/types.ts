export type HomeBriefReason =
  | "morningWake"
  | "inProgress"
  | "nextEventSoon"
  | "eventStarting"
  | "eventEnded"
  | "goalNudge"
  | "reviewTimeNudge"
  | "dayWrap"
  | "default";

export type TimeOfDayBucket =
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night";

export interface HomeBriefEventSummary {
  id: string;
  title: string;
  startMinutes: number;
  duration: number;
  category?: string;
  isBig3?: boolean;
}

export interface HomeBriefGoalSummary {
  completedTasksCount: number;
  pendingTasksCount: number;
  topGoalTitle?: string;
}

export interface HomeBriefPersona {
  coachPersona?: string | null;
  morningMindset?: string | null;
  focusStyle?: string | null;
}

export interface HomeBriefContext {
  now: {
    /** ISO string in the user's local time representation. */
    iso: string;
    /** Minutes from midnight, in the active clock (demo or real). */
    minutesFromMidnight: number;
    /** 0-23 */
    hour24: number;
    /** 0-6 (Sun-Sat) */
    dayOfWeek: number;
    bucket: TimeOfDayBucket;
  };

  rhythm: {
    wakeMinutesFromMidnight: number | null;
    sleepMinutesFromMidnight: number | null;
    /** True when we consider the user “just woke up” and should start with “This is the …” */
    isWakeWindowActive: boolean;
  };

  profile: {
    fullName?: string | null;
    /** YYYY-MM-DD (preferred) */
    birthday?: string | null;
  };

  schedule: {
    currentEvent?: HomeBriefEventSummary;
    nextEvent?: HomeBriefEventSummary;
    minutesUntilNextEvent?: number | null;
  };

  goals: HomeBriefGoalSummary;

  reviewTime: {
    unassignedCount: number;
  };

  persona: HomeBriefPersona;
}

export interface HomeBriefDraft {
  line1: string;
  line2: string;
  line3?: string;
  reason: HomeBriefReason;
  /** stable key describing the moment; used for caching/refresh decisions */
  momentKey: string;
  /** ISO string */
  expiresAt: string;
  /** stable hash of relevant context */
  contextHash: string;
}

export interface HomeBriefResult extends HomeBriefDraft {
  /** 'rules' = local rules, 'llm' = OpenAI polished */
  source: "rules" | "llm";
}
