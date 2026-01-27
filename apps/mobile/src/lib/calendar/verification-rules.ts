import type { EventCategory } from "@/stores";

/**
 * Verification rules define what evidence signals confirm or contradict each event category.
 */

export type EvidenceType =
  | "location"
  | "screen_time"
  | "health_workout"
  | "health_sleep";

export interface VerificationRule {
  /** Expected place categories for this activity (null = any location is acceptable) */
  locationExpected: Array<
    "home" | "office" | "gym" | "restaurant" | "cafe" | null
  >;

  /** If true, location MUST match one of the expected places */
  locationRequired?: boolean;

  /** Apps that are acceptable during this activity */
  allowedApps?: string[];

  /** Apps that indicate distraction during this activity */
  distractionApps?: string[];

  /** Maximum acceptable screen time in minutes before flagging distraction */
  maxScreenTimeMinutes?: number;

  /** Maximum distraction app usage before marking as contradicted */
  maxDistractionMinutes?: number;

  /** If true, screen time is expected (e.g., for 'digital' category) */
  requiresScreenTime?: boolean;

  /** If true, a workout must be present to verify */
  requiresWorkout?: boolean;

  /** If true, having a workout during this activity contradicts it */
  workoutContradictsIfDuring?: boolean;

  /** If true, location should change significantly (for travel) */
  requiresLocationChange?: boolean;

  /** Which evidence types are used to verify this category */
  verifyWith: EvidenceType[];

  /** Weight for each evidence type (0-1, defaults to equal) */
  evidenceWeights?: Partial<Record<EvidenceType, number>>;
}

/**
 * Common distraction apps (social media, entertainment, games)
 */
export const DISTRACTION_APPS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "x",
  "facebook",
  "snapchat",
  "reddit",
  "netflix",
  "hulu",
  "disney+",
  "hbo",
  "candy crush",
  "clash",
  "wordle",
];

/**
 * Work-related apps
 */
export const WORK_APPS = [
  "slack",
  "gmail",
  "outlook",
  "teams",
  "zoom",
  "notion",
  "figma",
  "linear",
  "jira",
  "asana",
  "trello",
  "google docs",
  "google sheets",
  "excel",
  "word",
  "powerpoint",
  "keynote",
  "numbers",
  "pages",
  "calendar",
  "meet",
];

/**
 * Navigation/travel apps
 */
export const TRAVEL_APPS = [
  "maps",
  "google maps",
  "waze",
  "uber",
  "lyft",
  "spotify",
  "podcasts",
  "audible",
  "apple music",
  "youtube music",
];

/**
 * Verification rules for each event category
 */
export const VERIFICATION_RULES: Record<EventCategory, VerificationRule> = {
  // SLEEP: Should be at home, minimal screen time
  sleep: {
    locationExpected: ["home"],
    locationRequired: true,
    maxScreenTimeMinutes: 15,
    distractionApps: ["*"], // Any phone use during sleep is bad
    workoutContradictsIfDuring: true,
    verifyWith: ["location", "screen_time", "health_sleep"],
    evidenceWeights: {
      location: 0.4,
      screen_time: 0.3,
      health_sleep: 0.3,
    },
  },

  // ROUTINE: Morning/evening routines at home
  routine: {
    locationExpected: ["home"],
    maxScreenTimeMinutes: 30,
    distractionApps: DISTRACTION_APPS,
    maxDistractionMinutes: 15,
    verifyWith: ["location", "screen_time"],
  },

  // WORK: At office or home, work apps are acceptable
  work: {
    locationExpected: ["office", "home", "cafe"],
    allowedApps: WORK_APPS,
    distractionApps: DISTRACTION_APPS,
    maxDistractionMinutes: 20,
    verifyWith: ["location", "screen_time"],
    evidenceWeights: {
      location: 0.6,
      screen_time: 0.4,
    },
  },

  // MEETING: Typically at office, minimal phone distractions expected
  meeting: {
    locationExpected: ["office", "cafe", "restaurant", null], // Can be anywhere
    allowedApps: ["zoom", "teams", "meet", "webex", "calendar", "notes"],
    distractionApps: DISTRACTION_APPS,
    maxDistractionMinutes: 10,
    verifyWith: ["location", "screen_time"],
  },

  // MEAL: Restaurant, cafe, or home
  meal: {
    locationExpected: ["restaurant", "cafe", "home"],
    maxScreenTimeMinutes: 20,
    distractionApps: DISTRACTION_APPS,
    maxDistractionMinutes: 15,
    verifyWith: ["location", "screen_time"],
  },

  // HEALTH/FITNESS: Should have workout data or be at gym
  health: {
    locationExpected: ["gym", "home", null], // Outdoor exercise = no specific place
    requiresWorkout: true,
    allowedApps: [
      "strava",
      "nike",
      "peloton",
      "fitness",
      "health",
      "spotify",
      "podcasts",
    ],
    verifyWith: ["location", "health_workout"],
    evidenceWeights: {
      health_workout: 0.7,
      location: 0.3,
    },
  },

  // FAMILY: At home or outing locations, screen time = distraction
  family: {
    locationExpected: ["home", "restaurant", "cafe", null],
    distractionApps: ["*"], // Any significant phone use during family time is distraction
    maxDistractionMinutes: 15,
    verifyWith: ["location", "screen_time"],
    evidenceWeights: {
      screen_time: 0.7, // Screen time is the primary indicator
      location: 0.3,
    },
  },

  // SOCIAL: Various locations, moderate phone use acceptable
  social: {
    locationExpected: ["restaurant", "cafe", null],
    distractionApps: DISTRACTION_APPS,
    maxDistractionMinutes: 20,
    verifyWith: ["location", "screen_time"],
  },

  // TRAVEL: Location should change, navigation/music apps OK
  travel: {
    locationExpected: [null], // Any location
    requiresLocationChange: true,
    allowedApps: TRAVEL_APPS,
    verifyWith: ["location"],
  },

  // FINANCE: Could be anywhere, finance apps expected
  finance: {
    locationExpected: ["home", "office", null],
    allowedApps: [
      "bank",
      "mint",
      "ynab",
      "personal capital",
      "venmo",
      "paypal",
    ],
    verifyWith: ["screen_time"],
  },

  // COMM: Communication time - phone use is expected
  comm: {
    locationExpected: [null],
    allowedApps: [
      "phone",
      "messages",
      "whatsapp",
      "telegram",
      "signal",
      "facetime",
    ],
    requiresScreenTime: true,
    verifyWith: ["screen_time"],
  },

  // DIGITAL: Intentional screen time - fully expected
  digital: {
    locationExpected: [null],
    requiresScreenTime: true,
    verifyWith: ["screen_time"],
  },

  // UNKNOWN: No specific expectations
  unknown: {
    locationExpected: [null],
    verifyWith: [],
  },

  // FREE: No specific expectations, any activity is fine
  free: {
    locationExpected: [null],
    verifyWith: [],
  },
};

/**
 * Check if an app name matches any in a list (case-insensitive partial match)
 */
export function appMatchesList(appName: string, appList: string[]): boolean {
  const normalized = appName.toLowerCase();
  return appList.some((app) => {
    if (app === "*") return true;
    return normalized.includes(app.toLowerCase());
  });
}

/**
 * Get the verification rule for a category, with fallback to 'unknown'
 */
export function getVerificationRule(category: EventCategory): VerificationRule {
  return VERIFICATION_RULES[category] ?? VERIFICATION_RULES.unknown;
}
