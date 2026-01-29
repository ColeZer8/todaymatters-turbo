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
