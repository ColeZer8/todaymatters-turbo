/**
 * Activity Inference Descriptions
 *
 * Generates human-readable explanations for why activities were classified
 * the way they were. Uses pattern matching on app usage, location data,
 * time of day, and other signals to create helpful inference descriptions.
 *
 * No AI needed — just smart templates based on data patterns.
 */

import type { InferredActivityType } from "./activity-segments";
import type { SummaryAppBreakdown } from "./hourly-summaries";
import type { InferredPlace } from "./place-inference";

// ============================================================================
// Types
// ============================================================================

export interface InferenceContext {
  /** Primary activity type */
  activity: InferredActivityType | null;
  /** App breakdown for the hour */
  apps: SummaryAppBreakdown[];
  /** Total screen time in minutes */
  screenMinutes: number;
  /** Hour of day (0-23) */
  hourOfDay: number;
  /** Place label (user-defined or inferred) */
  placeLabel: string | null;
  /** Previous hour's place label (for travel descriptions) */
  previousPlaceLabel?: string | null;
  /** Inferred place data */
  inferredPlace?: InferredPlace | null;
  /** Number of location samples */
  locationSamples: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Previous hour's geohash (for travel detection) */
  previousGeohash?: string | null;
  /** Current hour's geohash */
  currentGeohash?: string | null;
  /** Location radius in meters (large = movement) */
  locationRadius?: number | null;
  /** Google place types for location (e.g., ["library", "point_of_interest"]) */
  googlePlaceTypes?: string[] | null;
}

export interface InferenceDescription {
  /** Main inference explanation */
  primary: string;
  /** Secondary details (optional) */
  secondary?: string;
  /** Icon hint for the UI */
  iconHint: "activity" | "place" | "travel" | "sleep" | "work" | "spiritual" | "social" | "apps";
}

// ============================================================================
// App Category Detection
// ============================================================================

const SPIRITUAL_APPS = [
  "bible", "youversion", "pray", "church", "sermon", "worship", "devotional",
  "jesus", "god", "faith", "christian", "gospel", "scripture"
];

const WORK_APPS = [
  "slack", "teams", "zoom", "meet", "gmail", "outlook", "notion", "asana",
  "trello", "jira", "github", "vscode", "code", "figma", "linear", "discord"
];

const SOCIAL_APPS = [
  "instagram", "twitter", "facebook", "snapchat", "tiktok", "whatsapp",
  "messenger", "telegram", "signal", "imessage", "messages"
];

const FITNESS_APPS = [
  "strava", "nike", "fitbit", "health", "workout", "gym", "peloton",
  "myfitnesspal", "strong", "fitness"
];

const ENTERTAINMENT_APPS = [
  "youtube", "netflix", "spotify", "hulu", "disney", "hbo", "twitch",
  "podcasts", "music", "video", "tv"
];

const PRODUCTIVITY_APPS = [
  "notes", "reminders", "calendar", "todoist", "things", "bear",
  "obsidian", "roam", "evernote", "mobile", "todaymatters", "today matters",
  "notion", "docs", "sheets", "drive", "dropbox", "files", "safari", "chrome",
  "browser", "kindle", "books", "reader", "pdf", "documents"
];

function matchesCategory(appName: string, category: string[]): boolean {
  const lower = appName.toLowerCase();
  return category.some(keyword => lower.includes(keyword));
}

function categorizeApps(apps: SummaryAppBreakdown[]): {
  spiritual: number;
  work: number;
  social: number;
  fitness: number;
  entertainment: number;
  productivity: number;
  total: number;
} {
  const result = {
    spiritual: 0,
    work: 0,
    social: 0,
    fitness: 0,
    entertainment: 0,
    productivity: 0,
    total: 0,
  };

  for (const app of apps) {
    result.total += app.minutes;
    
    if (matchesCategory(app.displayName, SPIRITUAL_APPS)) {
      result.spiritual += app.minutes;
    } else if (matchesCategory(app.displayName, WORK_APPS)) {
      result.work += app.minutes;
    } else if (matchesCategory(app.displayName, SOCIAL_APPS)) {
      result.social += app.minutes;
    } else if (matchesCategory(app.displayName, FITNESS_APPS)) {
      result.fitness += app.minutes;
    } else if (matchesCategory(app.displayName, ENTERTAINMENT_APPS)) {
      result.entertainment += app.minutes;
    } else if (matchesCategory(app.displayName, PRODUCTIVITY_APPS)) {
      result.productivity += app.minutes;
    }
  }

  return result;
}

function getDominantAppCategory(apps: SummaryAppBreakdown[]): {
  category: string | null;
  percentage: number;
  topApp: string | null;
} {
  const categories = categorizeApps(apps);
  
  if (categories.total === 0) {
    return { category: null, percentage: 0, topApp: null };
  }

  const entries: [string, number][] = [
    ["spiritual", categories.spiritual],
    ["work", categories.work],
    ["social", categories.social],
    ["fitness", categories.fitness],
    ["entertainment", categories.entertainment],
    ["productivity", categories.productivity],
  ];

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [topCategory, topMinutes] = sorted[0];
  
  if (topMinutes === 0) {
    return { category: null, percentage: 0, topApp: apps[0]?.displayName ?? null };
  }

  const percentage = Math.round((topMinutes / categories.total) * 100);
  const topApp = apps[0]?.displayName ?? null;

  return { category: topCategory, percentage, topApp };
}

// ============================================================================
// Time-Based Helpers
// ============================================================================

function getTimeOfDayContext(hour: number): string {
  if (hour >= 5 && hour < 9) return "early morning";
  if (hour >= 9 && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  if (hour >= 20 && hour < 23) return "night";
  return "late night";
}

function isTypicalSleepHour(hour: number): boolean {
  return hour >= 22 || hour < 7;
}

function isTypicalWorkHour(hour: number): boolean {
  return hour >= 9 && hour < 18;
}

// ============================================================================
// Main Inference Generator
// ============================================================================

/**
 * Generate a human-readable inference description based on activity context.
 */
export function generateInferenceDescription(
  context: InferenceContext
): InferenceDescription | null {
  const { activity, apps, screenMinutes, hourOfDay, placeLabel, inferredPlace,
    locationSamples, confidence, previousGeohash, currentGeohash, locationRadius } = context;

  // Priority 1: Travel detection (geohash changed or large radius)
  const travelDescription = detectTravel(context);
  if (travelDescription) return travelDescription;

  // Priority 2: Sleep detection
  const sleepDescription = detectSleep(context);
  if (sleepDescription) return sleepDescription;

  // Priority 3: Activity-based inference
  const activityDescription = generateActivityDescription(context);
  if (activityDescription) return activityDescription;

  // Priority 4: App-based inference (fallback)
  const appDescription = generateAppBasedDescription(context);
  if (appDescription) return appDescription;

  // No meaningful inference possible
  return null;
}

// ============================================================================
// Travel Detection
// ============================================================================

function detectTravel(context: InferenceContext): InferenceDescription | null {
  const { previousGeohash, currentGeohash, locationRadius, activity, placeLabel, previousPlaceLabel, locationSamples } = context;

  // Geohash changed = definitely moved
  if (previousGeohash && currentGeohash && previousGeohash !== currentGeohash) {
    const origin = previousPlaceLabel && previousPlaceLabel !== "Unknown Location"
      ? previousPlaceLabel
      : null;
    const destination = placeLabel && placeLabel !== "Unknown Location"
      ? placeLabel
      : null;
    
    // Build a nice travel description with actual place names
    let travelDesc: string;
    if (origin && destination) {
      travelDesc = `Traveled from ${origin} to ${destination}`;
    } else if (destination) {
      travelDesc = `Arrived at ${destination}`;
    } else if (origin) {
      travelDesc = `Left ${origin}`;
    } else {
      travelDesc = `Location changed`;
    }
    
    return {
      primary: travelDesc,
      secondary: origin && destination 
        ? `Movement detected between locations`
        : `Geohash change indicates travel`,
      iconHint: "travel",
    };
  }

  // Large radius suggests movement within the hour
  if (locationRadius && locationRadius > 500) {
    const radiusKm = (locationRadius / 1000).toFixed(1);
    const destination = placeLabel && placeLabel !== "Unknown Location" ? placeLabel : null;
    return {
      primary: destination ? `In transit to ${destination}` : `Movement detected (${radiusKm}km radius)`,
      secondary: `Location samples spread across a wide area → likely in transit`,
      iconHint: "travel",
    };
  }

  // Activity type is commute
  if (activity === "commute") {
    const destination = placeLabel && placeLabel !== "Unknown Location" ? placeLabel : null;
    return {
      primary: destination ? `Commute to ${destination}` : `Commute/Transit detected`,
      secondary: locationSamples > 10
        ? `${locationSamples} location samples showing movement pattern`
        : `Movement pattern detected from location data`,
      iconHint: "travel",
    };
  }

  return null;
}

// ============================================================================
// Sleep Detection
// ============================================================================

function detectSleep(context: InferenceContext): InferenceDescription | null {
  const { activity, screenMinutes, hourOfDay, locationSamples, placeLabel } = context;

  // Explicit sleep activity
  if (activity === "sleep") {
    const timeContext = getTimeOfDayContext(hourOfDay);
    const atHome = placeLabel?.toLowerCase().includes("home");
    
    let secondary = "";
    if (screenMinutes === 0 && isTypicalSleepHour(hourOfDay)) {
      secondary = `No screen activity during ${timeContext} hours → Sleep inferred`;
    } else if (screenMinutes === 0) {
      secondary = `No screen activity + stationary location`;
    } else {
      secondary = `Minimal activity detected`;
    }

    if (atHome) {
      secondary += ` • At home`;
    }

    return {
      primary: `Sleep/Rest period`,
      secondary,
      iconHint: "sleep",
    };
  }

  // Infer sleep from patterns (no screen, night hours, stationary)
  if (screenMinutes === 0 && isTypicalSleepHour(hourOfDay) && locationSamples < 20) {
    const timeContext = getTimeOfDayContext(hourOfDay);
    return {
      primary: `Likely asleep`,
      secondary: `No screen activity during ${timeContext} hours • Sparse location data`,
      iconHint: "sleep",
    };
  }

  return null;
}

// ============================================================================
// Place-Based Activity Inference
// ============================================================================

/**
 * Infer activity based on place type/name.
 * Libraries, gyms, churches, etc. have strong activity signals.
 */
function inferActivityFromPlace(context: InferenceContext): InferenceDescription | null {
  const { placeLabel, apps, screenMinutes, googlePlaceTypes } = context;
  
  if (!placeLabel || placeLabel === "Unknown Location") return null;
  
  const placeLower = placeLabel.toLowerCase();
  const appCategories = categorizeApps(apps);
  const { category: dominantCategory, percentage, topApp } = getDominantAppCategory(apps);
  
  // Library = productive/reading/work
  if (placeLower.includes("library") || googlePlaceTypes?.includes("library")) {
    const activity = dominantCategory === "work" || dominantCategory === "productivity"
      ? "Productive work session"
      : screenMinutes > 10 
        ? "Reading/Study time"
        : "Library visit";
    
    const secondary = apps.length > 0 && screenMinutes > 5
      ? `At ${placeLabel} • ${topApp} (${apps[0]?.minutes}m)`
      : `At ${placeLabel} • Likely reading or studying`;
    
    return {
      primary: activity,
      secondary,
      iconHint: "work",
    };
  }
  
  // Gym/Fitness center = workout
  if (placeLower.includes("gym") || placeLower.includes("fitness") || 
      placeLower.includes("crossfit") || placeLower.includes("yoga") ||
      googlePlaceTypes?.includes("gym") || googlePlaceTypes?.includes("health")) {
    return {
      primary: `Workout session`,
      secondary: `At ${placeLabel}${screenMinutes < 10 ? " • Active exercise" : ""}`,
      iconHint: "activity",
    };
  }
  
  // Church = spiritual
  if (placeLower.includes("church") || placeLower.includes("chapel") ||
      placeLower.includes("temple") || placeLower.includes("mosque") ||
      googlePlaceTypes?.includes("church") || googlePlaceTypes?.includes("place_of_worship")) {
    return {
      primary: `Church/Worship time`,
      secondary: `At ${placeLabel}`,
      iconHint: "spiritual",
    };
  }
  
  // School/University = learning/productive
  if (placeLower.includes("school") || placeLower.includes("university") ||
      placeLower.includes("college") || placeLower.includes("campus") ||
      googlePlaceTypes?.includes("school") || googlePlaceTypes?.includes("university")) {
    const activity = dominantCategory === "work" || dominantCategory === "productivity"
      ? "Study/Class session"
      : "School/Campus time";
    return {
      primary: activity,
      secondary: `At ${placeLabel}${topApp ? ` • ${topApp}` : ""}`,
      iconHint: "work",
    };
  }
  
  // Coffee shop/Cafe = could be work or social
  if (placeLower.includes("coffee") || placeLower.includes("cafe") ||
      placeLower.includes("starbucks") || placeLower.includes("dunkin") ||
      googlePlaceTypes?.includes("cafe")) {
    const isProductive = appCategories.work > 10 || appCategories.productivity > 10;
    return {
      primary: isProductive ? `Working from café` : `Coffee break`,
      secondary: `At ${placeLabel}${topApp && screenMinutes > 5 ? ` • ${topApp}` : ""}`,
      iconHint: isProductive ? "work" : "activity",
    };
  }
  
  // Restaurant = dining/meal
  if (placeLower.includes("restaurant") || placeLower.includes("grill") ||
      placeLower.includes("kitchen") || placeLower.includes("diner") ||
      placeLower.includes("cafe") || placeLower.includes("eatery") ||
      googlePlaceTypes?.includes("restaurant") || googlePlaceTypes?.includes("food")) {
    return {
      primary: `Dining out`,
      secondary: `At ${placeLabel}`,
      iconHint: "activity",
    };
  }
  
  // Store/Shopping = errands
  if (placeLower.includes("store") || placeLower.includes("market") ||
      placeLower.includes("shop") || placeLower.includes("mall") ||
      placeLower.includes("target") || placeLower.includes("walmart") ||
      placeLower.includes("costco") || placeLower.includes("grocery") ||
      googlePlaceTypes?.includes("store") || googlePlaceTypes?.includes("shopping_mall")) {
    return {
      primary: `Shopping/Errands`,
      secondary: `At ${placeLabel}`,
      iconHint: "activity",
    };
  }
  
  // Office/Work location
  if (placeLower.includes("office") || placeLower.includes("work") ||
      placeLower.includes("headquarters") || placeLower.includes("hq") ||
      googlePlaceTypes?.includes("office")) {
    const workApps = apps.filter(a => matchesCategory(a.displayName, WORK_APPS));
    return {
      primary: `Work session`,
      secondary: workApps.length > 0 
        ? `At ${placeLabel} • ${workApps.slice(0, 2).map(a => a.displayName).join(", ")}`
        : `At ${placeLabel}`,
      iconHint: "work",
    };
  }
  
  return null;
}

// ============================================================================
// Activity-Based Descriptions
// ============================================================================

function generateActivityDescription(context: InferenceContext): InferenceDescription | null {
  const { activity, apps, screenMinutes, hourOfDay, placeLabel } = context;
  
  // First, try place-based inference (library, gym, church, etc.)
  const placeBasedInference = inferActivityFromPlace(context);
  if (placeBasedInference) return placeBasedInference;
  
  if (!activity) return null;

  const appCategories = categorizeApps(apps);
  const { category: dominantCategory, percentage, topApp } = getDominantAppCategory(apps);
  const timeContext = getTimeOfDayContext(hourOfDay);
  const atWork = placeLabel?.toLowerCase().includes("work") || placeLabel?.toLowerCase().includes("office");
  const atHome = placeLabel?.toLowerCase().includes("home");

  switch (activity) {
    case "deep_work":
      return {
        primary: `Deep work session`,
        secondary: generateDeepWorkReasoning(apps, dominantCategory, percentage, timeContext, atWork),
        iconHint: "work",
      };

    case "collaborative_work":
      return {
        primary: `Collaborative work`,
        secondary: generateCollaborativeWorkReasoning(apps, timeContext),
        iconHint: "work",
      };

    case "meeting":
      return {
        primary: `Meeting time`,
        secondary: generateMeetingReasoning(apps, timeContext, atWork),
        iconHint: "work",
      };

    case "workout":
      return {
        primary: `Workout/Exercise`,
        secondary: generateWorkoutReasoning(apps, screenMinutes, placeLabel),
        iconHint: "activity",
      };

    case "leisure":
      return {
        primary: `Leisure time`,
        secondary: generateLeisureReasoning(apps, dominantCategory, timeContext, atHome),
        iconHint: "apps",
      };

    case "extended_social":
    case "social_break":
      return {
        primary: activity === "extended_social" ? `Social time` : `Social break`,
        secondary: generateSocialReasoning(apps, appCategories.social, timeContext),
        iconHint: "social",
      };

    case "personal_time":
      return {
        primary: `Personal time`,
        secondary: generatePersonalTimeReasoning(apps, screenMinutes, timeContext),
        iconHint: "activity",
      };

    case "away_from_desk":
      return {
        primary: `Away from desk`,
        secondary: `Minimal screen activity • Likely offline or on the move`,
        iconHint: "activity",
      };

    case "offline_activity":
      return {
        primary: `Offline activity`,
        secondary: `No screen time recorded • Physical activity or device-free time`,
        iconHint: "activity",
      };

    case "distracted_time":
      return {
        primary: `Fragmented attention`,
        secondary: generateDistractedReasoning(apps),
        iconHint: "apps",
      };

    case "mixed_activity":
      // Try to infer a better activity from apps/place instead of "Mixed Activity"
      return generateSmartMixedActivityDescription(context);

    default:
      return null;
  }
}

// ============================================================================
// Specific Activity Reasoning Generators
// ============================================================================

function generateDeepWorkReasoning(
  apps: SummaryAppBreakdown[],
  dominantCategory: string | null,
  percentage: number,
  timeContext: string,
  atWork: boolean | undefined
): string {
  const parts: string[] = [];

  if (dominantCategory === "work" && percentage >= 60) {
    parts.push(`${percentage}% work app usage`);
  }

  const productivityApps = apps.filter(a => 
    matchesCategory(a.displayName, [...WORK_APPS, ...PRODUCTIVITY_APPS])
  ).slice(0, 2);

  if (productivityApps.length > 0) {
    const appList = productivityApps.map(a => `${a.displayName} (${a.minutes}m)`).join(", ");
    parts.push(appList);
  }

  if (atWork) {
    parts.push("at work location");
  }

  return parts.length > 0 ? parts.join(" • ") : `Focused work session during ${timeContext}`;
}

function generateCollaborativeWorkReasoning(apps: SummaryAppBreakdown[], timeContext: string): string {
  const commApps = apps.filter(a => 
    matchesCategory(a.displayName, ["slack", "teams", "discord", "zoom", "meet"])
  );

  if (commApps.length > 0) {
    const appList = commApps.slice(0, 2).map(a => a.displayName).join(" + ");
    return `${appList} active → Team communication`;
  }

  return `Communication-heavy work session`;
}

function generateMeetingReasoning(
  apps: SummaryAppBreakdown[],
  timeContext: string,
  atWork: boolean | undefined
): string {
  const meetingApps = apps.filter(a =>
    matchesCategory(a.displayName, ["zoom", "meet", "teams", "webex", "facetime"])
  );

  if (meetingApps.length > 0) {
    const app = meetingApps[0];
    return `${app.displayName} (${app.minutes}m) → Video/voice call detected`;
  }

  if (atWork) {
    return `Meeting time at work location`;
  }

  return `Meeting/call activity detected`;
}

function generateWorkoutReasoning(
  apps: SummaryAppBreakdown[],
  screenMinutes: number,
  placeLabel: string | null
): string {
  const fitnessApps = apps.filter(a => matchesCategory(a.displayName, FITNESS_APPS));
  const parts: string[] = [];

  if (fitnessApps.length > 0) {
    parts.push(`${fitnessApps[0].displayName} active`);
  }

  if (placeLabel?.toLowerCase().includes("gym")) {
    parts.push("at gym");
  }

  if (screenMinutes < 5) {
    parts.push("minimal screen time during activity");
  }

  return parts.length > 0 ? parts.join(" • ") : "Physical activity detected";
}

function generateLeisureReasoning(
  apps: SummaryAppBreakdown[],
  dominantCategory: string | null,
  timeContext: string,
  atHome: boolean | undefined
): string {
  const parts: string[] = [];

  // Check for spiritual content (Bible study, etc.)
  const spiritualApps = apps.filter(a => matchesCategory(a.displayName, SPIRITUAL_APPS));
  if (spiritualApps.length > 0 && spiritualApps[0].minutes >= 10) {
    const app = spiritualApps[0];
    return `${app.displayName} (${app.minutes}m) → Bible study/devotional time`;
  }

  // Check for entertainment
  const entertainmentApps = apps.filter(a => matchesCategory(a.displayName, ENTERTAINMENT_APPS));
  if (entertainmentApps.length > 0) {
    const app = entertainmentApps[0];
    if (app.displayName.toLowerCase().includes("youtube")) {
      // Check if paired with Bible app
      if (spiritualApps.length > 0) {
        return `${spiritualApps[0].displayName} + YouTube → Likely sermon/worship content`;
      }
      parts.push(`YouTube (${app.minutes}m)`);
    } else {
      parts.push(`${app.displayName} (${app.minutes}m)`);
    }
  }

  if (atHome) {
    parts.push("relaxing at home");
  } else if (timeContext === "evening" || timeContext === "night") {
    parts.push(`${timeContext} downtime`);
  }

  return parts.length > 0 ? parts.join(" • ") : "Relaxation/personal time";
}

function generateSocialReasoning(
  apps: SummaryAppBreakdown[],
  socialMinutes: number,
  timeContext: string
): string {
  const socialApps = apps.filter(a => matchesCategory(a.displayName, SOCIAL_APPS));

  if (socialApps.length > 0) {
    const appList = socialApps.slice(0, 2).map(a => `${a.displayName} (${a.minutes}m)`).join(", ");
    return `${appList} → Social/messaging activity`;
  }

  if (socialMinutes > 0) {
    return `${socialMinutes}m on social/messaging apps`;
  }

  return `Social interaction during ${timeContext}`;
}

function generatePersonalTimeReasoning(
  apps: SummaryAppBreakdown[],
  screenMinutes: number,
  timeContext: string
): string {
  if (screenMinutes < 10) {
    return `Light phone usage • Mostly offline ${timeContext} time`;
  }

  const topApp = apps[0];
  if (topApp) {
    return `${topApp.displayName} (${topApp.minutes}m) • Personal ${timeContext} time`;
  }

  return `Personal activities during ${timeContext}`;
}

function generateDistractedReasoning(apps: SummaryAppBreakdown[]): string {
  if (apps.length >= 5) {
    return `Rapid app switching (${apps.length}+ apps) → Fragmented attention`;
  }

  const socialApps = apps.filter(a => matchesCategory(a.displayName, SOCIAL_APPS));
  if (socialApps.length > 0) {
    return `Social media browsing → Distracted time`;
  }

  return `Multiple short app sessions → Scattered focus`;
}

/**
 * Smart inference for "mixed_activity" - tries to determine a better label
 * based on place context and app usage patterns.
 */
function generateSmartMixedActivityDescription(context: InferenceContext): InferenceDescription {
  const { apps, screenMinutes, placeLabel, hourOfDay } = context;
  const appCategories = categorizeApps(apps);
  const { category: dominantCategory, percentage, topApp } = getDominantAppCategory(apps);
  const timeContext = getTimeOfDayContext(hourOfDay);
  const placeLower = placeLabel?.toLowerCase() ?? "";
  
  // Determine what they're likely doing based on place + apps
  let inferredActivity: string;
  let reasoning: string;
  let iconHint: InferenceDescription["iconHint"] = "activity";
  
  // Strong app signal overrides place
  if (dominantCategory && percentage >= 40) {
    switch (dominantCategory) {
      case "spiritual":
        inferredActivity = "Devotional time";
        reasoning = `${topApp} (${percentage}%) → Spiritual activity`;
        iconHint = "spiritual";
        break;
      case "work":
        inferredActivity = "Work session";
        reasoning = `${topApp} (${percentage}%) → Productive work`;
        iconHint = "work";
        break;
      case "productivity":
        inferredActivity = "Productive time";
        reasoning = `${topApp} (${percentage}%) → Focused activity`;
        iconHint = "work";
        break;
      case "social":
        inferredActivity = "Social time";
        reasoning = `${topApp} (${percentage}%) → Messaging/social`;
        iconHint = "social";
        break;
      case "entertainment":
        inferredActivity = "Entertainment";
        reasoning = `${topApp} (${percentage}%) → Media/entertainment`;
        iconHint = "apps";
        break;
      case "fitness":
        inferredActivity = "Fitness activity";
        reasoning = `${topApp} active → Workout tracking`;
        iconHint = "activity";
        break;
      default:
        inferredActivity = "General activity";
        reasoning = `${topApp} (${screenMinutes}m)`;
    }
  }
  // Place-based inference when no strong app signal
  else if (placeLabel && placeLabel !== "Unknown Location") {
    // Home = personal/leisure time
    if (placeLower.includes("home")) {
      if (screenMinutes > 20) {
        inferredActivity = "Personal time at home";
        reasoning = apps.length > 0 
          ? `At home • ${apps.slice(0, 2).map(a => a.displayName).join(", ")}`
          : `At home • ${screenMinutes}m screen time`;
      } else if (screenMinutes === 0) {
        inferredActivity = "Offline time at home";
        reasoning = "At home • No screen activity";
      } else {
        inferredActivity = "Home time";
        reasoning = `At home • Light phone usage`;
      }
      iconHint = "activity";
    }
    // Work location
    else if (placeLower.includes("work") || placeLower.includes("office")) {
      inferredActivity = "Work time";
      reasoning = `At ${placeLabel}`;
      iconHint = "work";
    }
    // Other named place
    else {
      if (screenMinutes > 10 && apps.length > 0) {
        const isProductive = appCategories.work > 5 || appCategories.productivity > 5;
        inferredActivity = isProductive ? `Productive time` : `Time at ${placeLabel}`;
        reasoning = `At ${placeLabel} • ${apps.slice(0, 2).map(a => a.displayName).join(", ")}`;
        iconHint = isProductive ? "work" : "activity";
      } else {
        inferredActivity = `Time at ${placeLabel}`;
        reasoning = screenMinutes > 0 
          ? `${screenMinutes}m screen time`
          : `Offline activity at location`;
        iconHint = "place";
      }
    }
  }
  // Fallback: time-of-day based inference
  else {
    if (screenMinutes === 0) {
      inferredActivity = "Offline activity";
      reasoning = "No screen time recorded";
      iconHint = "activity";
    } else if (isTypicalWorkHour(hourOfDay) && (appCategories.work > 5 || appCategories.productivity > 5)) {
      inferredActivity = "Productive time";
      reasoning = `${timeContext} • ${topApp || "various apps"}`;
      iconHint = "work";
    } else {
      inferredActivity = "General activity";
      reasoning = apps.length > 0 
        ? `${apps.slice(0, 2).map(a => `${a.displayName} (${a.minutes}m)`).join(", ")}`
        : `${screenMinutes}m screen time`;
      iconHint = "apps";
    }
  }
  
  return {
    primary: inferredActivity,
    secondary: reasoning,
    iconHint,
  };
}

// ============================================================================
// App-Based Fallback Description
// ============================================================================

function generateAppBasedDescription(context: InferenceContext): InferenceDescription | null {
  const { apps, screenMinutes, hourOfDay, placeLabel } = context;
  
  if (apps.length === 0 && screenMinutes === 0) {
    return {
      primary: "Offline time",
      secondary: "No screen activity recorded this hour",
      iconHint: "activity",
    };
  }

  const { category, percentage, topApp } = getDominantAppCategory(apps);
  const timeContext = getTimeOfDayContext(hourOfDay);

  // Strong category signal
  if (category && percentage >= 50) {
    switch (category) {
      case "spiritual":
        return {
          primary: "Spiritual/Devotional time",
          secondary: `${topApp} dominant (${percentage}%) → Bible study or prayer`,
          iconHint: "spiritual",
        };
      case "work":
        return {
          primary: "Work session",
          secondary: `${percentage}% work apps → Professional activity`,
          iconHint: "work",
        };
      case "social":
        return {
          primary: "Social/Messaging",
          secondary: `${percentage}% social apps → Communication time`,
          iconHint: "social",
        };
      case "fitness":
        return {
          primary: "Fitness activity",
          secondary: `${topApp} active → Workout tracking`,
          iconHint: "activity",
        };
      case "entertainment":
        return {
          primary: "Entertainment",
          secondary: `${topApp} (${percentage}%) → Media consumption`,
          iconHint: "apps",
        };
    }
  }

  // Fallback: describe top app
  if (topApp && screenMinutes >= 5) {
    return {
      primary: "Screen activity",
      secondary: `Primarily ${topApp} • ${screenMinutes}m total screen time`,
      iconHint: "apps",
    };
  }

  return null;
}

// ============================================================================
// Export Types
// ============================================================================

export type { InferredActivityType };
