/**
 * Default app category mappings for intent classification.
 *
 * These categories determine how screen-time sessions are classified as
 * Work, Leisure, Distracted Work, etc. Users can override these via
 * tm.user_app_categories table.
 *
 * Categories:
 * - work: Productivity and work-related apps
 * - social: Social media and networking apps
 * - entertainment: Media consumption and gaming apps
 * - comms: Communication and messaging apps
 * - utility: System and utility apps
 * - ignore: Apps to exclude from classification (e.g., system processes)
 */

import { normalizeAppKey } from "@/lib/calendar/app-classification";

/**
 * App category for intent classification.
 * Different from EventCategory - this is specifically for classifying
 * what type of app is being used to determine work/leisure intent.
 */
export type AppCategory =
  | "work"
  | "social"
  | "entertainment"
  | "comms"
  | "utility"
  | "ignore";

/**
 * User override for app category from tm.user_app_categories
 */
export interface UserAppCategoryOverride {
  category: AppCategory;
  confidence?: number;
}

/**
 * Map of app keys to user overrides
 */
export type UserAppCategoryOverrides = Record<string, UserAppCategoryOverride>;

/**
 * Default app category mappings.
 * Keys are normalized app names (lowercase, trimmed).
 */
export const DEFAULT_APP_CATEGORIES: Record<string, AppCategory> = {
  // Work apps - productivity, documentation, meetings, design
  slack: "work",
  "google docs": "work",
  docs: "work",
  gmail: "work",
  "google meet": "work",
  meet: "work",
  zoom: "work",
  calendar: "work",
  "google calendar": "work",
  figma: "work",
  notion: "work",
  linear: "work",
  "vs code": "work",
  "visual studio code": "work",
  code: "work",
  xcode: "work",
  "android studio": "work",
  teams: "work",
  "microsoft teams": "work",
  outlook: "work",
  "google sheets": "work",
  sheets: "work",
  excel: "work",
  "microsoft excel": "work",
  word: "work",
  "microsoft word": "work",
  powerpoint: "work",
  "microsoft powerpoint": "work",
  keynote: "work",
  numbers: "work",
  pages: "work",
  jira: "work",
  asana: "work",
  trello: "work",
  monday: "work",
  clickup: "work",
  basecamp: "work",
  confluence: "work",
  github: "work",
  gitlab: "work",
  bitbucket: "work",
  terminal: "work",
  iterm: "work",
  webex: "work",
  "cisco webex": "work",
  miro: "work",
  sketch: "work",
  "adobe xd": "work",
  photoshop: "work",
  illustrator: "work",
  "premiere pro": "work",
  "after effects": "work",
  canva: "work",
  dropbox: "work",
  "google drive": "work",
  drive: "work",
  evernote: "work",
  bear: "work",
  obsidian: "work",
  roam: "work",
  craft: "work",
  quip: "work",
  airtable: "work",
  coda: "work",
  loom: "work",
  calendly: "work",

  // Social apps - social media and networking
  instagram: "social",
  tiktok: "social",
  "x": "social",
  twitter: "social",
  reddit: "social",
  facebook: "social",
  snapchat: "social",
  linkedin: "social",
  threads: "social",
  mastodon: "social",
  bluesky: "social",
  pinterest: "social",
  tumblr: "social",
  discord: "social",
  clubhouse: "social",
  nextdoor: "social",
  yelp: "social",
  strava: "social",
  untappd: "social",
  goodreads: "social",
  letterboxd: "social",

  // Entertainment apps - media, streaming, games
  youtube: "entertainment",
  netflix: "entertainment",
  spotify: "entertainment",
  "apple music": "entertainment",
  music: "entertainment",
  twitch: "entertainment",
  "disney+": "entertainment",
  disney: "entertainment",
  disneyplus: "entertainment",
  podcasts: "entertainment",
  "apple podcasts": "entertainment",
  overcast: "entertainment",
  "pocket casts": "entertainment",
  hulu: "entertainment",
  "hbo max": "entertainment",
  "max": "entertainment",
  "prime video": "entertainment",
  "amazon prime video": "entertainment",
  peacock: "entertainment",
  paramount: "entertainment",
  "paramount+": "entertainment",
  "apple tv": "entertainment",
  "apple tv+": "entertainment",
  plex: "entertainment",
  vlc: "entertainment",
  audible: "entertainment",
  kindle: "entertainment",
  books: "entertainment",
  "apple books": "entertainment",
  news: "entertainment",
  "apple news": "entertainment",
  "google news": "entertainment",
  flipboard: "entertainment",
  feedly: "entertainment",
  "youtube music": "entertainment",
  pandora: "entertainment",
  deezer: "entertainment",
  soundcloud: "entertainment",
  tidal: "entertainment",
  // Games (common ones)
  "candy crush": "entertainment",
  "clash royale": "entertainment",
  "clash of clans": "entertainment",
  wordle: "entertainment",
  "pokemon go": "entertainment",
  roblox: "entertainment",
  minecraft: "entertainment",
  "among us": "entertainment",
  "call of duty": "entertainment",
  fortnite: "entertainment",
  "genshin impact": "entertainment",
  "game center": "entertainment",
  steam: "entertainment",

  // Communication apps - messaging and calls
  messages: "comms",
  imessage: "comms",
  whatsapp: "comms",
  telegram: "comms",
  signal: "comms",
  phone: "comms",
  facetime: "comms",
  skype: "comms",
  viber: "comms",
  line: "comms",
  wechat: "comms",
  kakaotalk: "comms",
  messenger: "comms",
  "facebook messenger": "comms",
  mail: "comms",
  "apple mail": "comms",
  spark: "comms",
  airmail: "comms",
  "proton mail": "comms",
  contacts: "comms",

  // Utility apps - system tools, navigation, productivity utilities
  maps: "utility",
  "google maps": "utility",
  "apple maps": "utility",
  waze: "utility",
  photos: "utility",
  "google photos": "utility",
  weather: "utility",
  "apple weather": "utility",
  calculator: "utility",
  settings: "utility",
  files: "utility",
  finder: "utility",
  notes: "utility",
  "apple notes": "utility",
  reminders: "utility",
  "google keep": "utility",
  "voice memos": "utility",
  wallet: "utility",
  "apple wallet": "utility",
  "google pay": "utility",
  "apple pay": "utility",
  health: "utility",
  "apple health": "utility",
  fitness: "utility",
  "apple fitness": "utility",
  "activity": "utility",
  clock: "utility",
  alarms: "utility",
  timer: "utility",
  compass: "utility",
  measure: "utility",
  translate: "utility",
  "google translate": "utility",
  shortcuts: "utility",
  "siri shortcuts": "utility",
  "app store": "utility",
  "google play store": "utility",
  safari: "utility",
  chrome: "utility",
  "google chrome": "utility",
  firefox: "utility",
  edge: "utility",
  brave: "utility",
  arc: "utility",
  "1password": "utility",
  lastpass: "utility",
  bitwarden: "utility",
  authenticator: "utility",
  "google authenticator": "utility",
  authy: "utility",
  uber: "utility",
  lyft: "utility",
  doordash: "utility",
  "uber eats": "utility",
  grubhub: "utility",
  instacart: "utility",
  amazon: "utility",
  "amazon shopping": "utility",
  target: "utility",
  walmart: "utility",
  ebay: "utility",
  etsy: "utility",

  // System apps to ignore - don't count toward any category
  springboard: "ignore",
  siri: "ignore",
  "screen time": "ignore",
  "control center": "ignore",
  "notification center": "ignore",
  "app switcher": "ignore",
  "system preferences": "ignore",
  "system settings": "ignore",
  spotlight: "ignore",
  launchpad: "ignore",
  dock: "ignore",
  "mission control": "ignore",
  dashboard: "ignore",
  "login window": "ignore",
  installer: "ignore",
  "software update": "ignore",
  "today matters": "ignore",
  todaymatters: "ignore",
  mobile: "ignore",
};

/**
 * Get the category for an app, checking user overrides first.
 *
 * @param appId - The app identifier (bundle id or app name)
 * @param userOverrides - Optional user category overrides from tm.user_app_categories
 * @returns The app category, or 'utility' as fallback for unknown apps
 *
 * @example
 * ```ts
 * // Without overrides
 * getAppCategory("slack") // "work"
 * getAppCategory("instagram") // "social"
 * getAppCategory("unknown app") // "utility"
 *
 * // With user overrides
 * const overrides = { instagram: { category: "work" } };
 * getAppCategory("instagram", overrides) // "work"
 * ```
 */
export function getAppCategory(
  appId: string,
  userOverrides?: UserAppCategoryOverrides | null,
): AppCategory {
  const normalizedKey = normalizeAppKey(appId);
  if (!normalizedKey) {
    return "utility";
  }

  // Check user overrides first (highest priority)
  if (userOverrides) {
    const override = userOverrides[normalizedKey];
    if (override) {
      return override.category;
    }
  }

  // Check default mappings with exact match
  const defaultCategory = DEFAULT_APP_CATEGORIES[normalizedKey];
  if (defaultCategory) {
    return defaultCategory;
  }

  // Check default mappings with partial match (app name contains a known key)
  for (const [key, category] of Object.entries(DEFAULT_APP_CATEGORIES)) {
    if (normalizedKey.includes(key) || key.includes(normalizedKey)) {
      return category;
    }
  }

  // Default to utility for unknown apps (better than "unknown" for intent calculation)
  return "utility";
}

/**
 * Check if an app category is considered productive/work-related.
 */
export function isWorkCategory(category: AppCategory): boolean {
  return category === "work";
}

/**
 * Check if an app category is considered leisure/non-productive.
 */
export function isLeisureCategory(category: AppCategory): boolean {
  return category === "social" || category === "entertainment";
}

/**
 * Get all apps in a specific category from defaults.
 */
export function getAppsByCategory(category: AppCategory): string[] {
  return Object.entries(DEFAULT_APP_CATEGORIES)
    .filter(([, cat]) => cat === category)
    .map(([app]) => app);
}

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Intent types for session classification.
 */
export type Intent =
  | "work"
  | "leisure"
  | "distracted_work"
  | "offline"
  | "mixed"
  | "sleep";

/**
 * Summary of app usage within a session.
 */
export interface AppSummary {
  /** App identifier (bundle id or app name) */
  appId: string;
  /** Duration in seconds */
  seconds: number;
  /** Optional: pre-computed category (if not provided, will be computed) */
  category?: AppCategory;
}

/**
 * Result of intent classification with reasoning.
 */
export interface IntentClassificationResult {
  /** The classified intent */
  intent: Intent;
  /** Percentage breakdown by category */
  breakdown: {
    work: number;
    social: number;
    entertainment: number;
    comms: number;
    utility: number;
    ignore: number;
  };
  /** Total seconds of screen-time (excluding ignored apps) */
  totalSeconds: number;
  /** Human-readable reasoning for the classification */
  reasoning: string;
}

/**
 * Threshold constants for intent classification.
 */
export const INTENT_THRESHOLDS = {
  /** Minimum work percentage to classify as "work" */
  WORK_HIGH: 0.6,
  /** Minimum work percentage for "distracted_work" */
  WORK_MEDIUM_MIN: 0.4,
  /** Maximum work percentage for "distracted_work" (exclusive) */
  WORK_MEDIUM_MAX: 0.6,
  /** Minimum leisure (social + entertainment) percentage to classify as "leisure" */
  LEISURE_HIGH: 0.6,
  /** Minimum social percentage (with work 40-60%) to classify as "distracted_work" */
  SOCIAL_DISTRACTION: 0.25,
} as const;

/**
 * Classify the intent of a session based on app usage.
 *
 * Classification rules:
 * 1. If Work >= 60% → 'work'
 * 2. If Social + Entertainment >= 60% → 'leisure'
 * 3. If Work 40-60% AND Social >= 25% → 'distracted_work'
 * 4. If no screen-time → 'offline'
 * 5. Otherwise → 'mixed'
 *
 * @param screenTimeSummary - Array of app usage summaries
 * @param userOverrides - Optional user category overrides
 * @returns Intent classification with reasoning
 *
 * @example
 * ```ts
 * const summary = [
 *   { appId: "slack", seconds: 1800 },      // 30 min work
 *   { appId: "google docs", seconds: 1200 }, // 20 min work
 *   { appId: "instagram", seconds: 600 },    // 10 min social
 * ];
 * const result = classifyIntent(summary);
 * // result.intent === "work" (83% work)
 * ```
 */
export function classifyIntent(
  screenTimeSummary: AppSummary[],
  userOverrides?: UserAppCategoryOverrides | null,
): IntentClassificationResult {
  // Initialize breakdown
  const breakdown = {
    work: 0,
    social: 0,
    entertainment: 0,
    comms: 0,
    utility: 0,
    ignore: 0,
  };

  // Calculate total time per category
  for (const app of screenTimeSummary) {
    const category = app.category ?? getAppCategory(app.appId, userOverrides);
    breakdown[category] += app.seconds;
  }

  // Calculate total screen-time (excluding ignored apps)
  const totalSeconds =
    breakdown.work +
    breakdown.social +
    breakdown.entertainment +
    breakdown.comms +
    breakdown.utility;

  // Handle no screen-time case
  if (totalSeconds === 0) {
    return {
      intent: "offline",
      breakdown,
      totalSeconds: 0,
      reasoning: "No screen-time recorded",
    };
  }

  // Calculate percentages (excluding ignored apps)
  const workPercent = breakdown.work / totalSeconds;
  const socialPercent = breakdown.social / totalSeconds;
  const entertainmentPercent = breakdown.entertainment / totalSeconds;
  const leisurePercent = socialPercent + entertainmentPercent;

  // Apply classification rules in priority order

  // Rule 1: Work >= 60% → work
  if (workPercent >= INTENT_THRESHOLDS.WORK_HIGH) {
    const workPct = Math.round(workPercent * 100);
    return {
      intent: "work",
      breakdown,
      totalSeconds,
      reasoning: `Classified as Work: ${workPct}% work apps`,
    };
  }

  // Rule 2: Social + Entertainment >= 60% → leisure
  if (leisurePercent >= INTENT_THRESHOLDS.LEISURE_HIGH) {
    const leisurePct = Math.round(leisurePercent * 100);
    const socialPct = Math.round(socialPercent * 100);
    const entPct = Math.round(entertainmentPercent * 100);
    return {
      intent: "leisure",
      breakdown,
      totalSeconds,
      reasoning: `Classified as Leisure: ${leisurePct}% leisure (${socialPct}% social, ${entPct}% entertainment)`,
    };
  }

  // Rule 3: Work 40-60% AND Social >= 25% → distracted_work
  if (
    workPercent >= INTENT_THRESHOLDS.WORK_MEDIUM_MIN &&
    workPercent < INTENT_THRESHOLDS.WORK_MEDIUM_MAX &&
    socialPercent >= INTENT_THRESHOLDS.SOCIAL_DISTRACTION
  ) {
    const workPct = Math.round(workPercent * 100);
    const socialPct = Math.round(socialPercent * 100);
    return {
      intent: "distracted_work",
      breakdown,
      totalSeconds,
      reasoning: `Classified as Distracted Work: ${workPct}% work with ${socialPct}% social media`,
    };
  }

  // Rule 5: Otherwise → mixed
  const workPct = Math.round(workPercent * 100);
  const leisurePct = Math.round(leisurePercent * 100);
  const commsPct = Math.round((breakdown.comms / totalSeconds) * 100);
  const utilityPct = Math.round((breakdown.utility / totalSeconds) * 100);
  return {
    intent: "mixed",
    breakdown,
    totalSeconds,
    reasoning: `Classified as Mixed: ${workPct}% work, ${leisurePct}% leisure, ${commsPct}% comms, ${utilityPct}% utility`,
  };
}

/**
 * Simple version of classifyIntent that just returns the intent string.
 * Useful when you don't need the full breakdown and reasoning.
 */
export function classifyIntentSimple(
  screenTimeSummary: AppSummary[],
  userOverrides?: UserAppCategoryOverrides | null,
): Intent {
  return classifyIntent(screenTimeSummary, userOverrides).intent;
}
