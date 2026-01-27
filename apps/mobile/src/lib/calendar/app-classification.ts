import type { EventCategory } from "@/stores";
import {
  appMatchesList,
  DISTRACTION_APPS,
  WORK_APPS,
} from "./verification-rules";

const OVERRIDE_CONFIDENCE_MIN = 0.6;

const CATEGORY_TITLES: Record<EventCategory, string> = {
  routine: "Routine",
  work: "Work",
  meal: "Meal",
  meeting: "Meeting",
  health: "Health",
  family: "Family",
  social: "Social",
  travel: "Travel",
  finance: "Finance",
  comm: "Commute",
  digital: "Screen Time",
  sleep: "Sleep",
  unknown: "Unknown",
  free: "Free",
};

export const PRODUCTIVE_APPS = [
  "calculator",
  "notes",
  "today matters",
  "todaymatters",
  "mobile",
];

export interface AppCategoryOverride {
  category: EventCategory;
  confidence: number;
}

export type AppCategoryOverrides = Record<string, AppCategoryOverride>;

export interface AppClassification {
  title: string;
  description: string;
  category: EventCategory;
  isDistraction: boolean;
  isWork: boolean;
  isProductive: boolean;
  confidence: number;
}

export function normalizeAppKey(value: string): string {
  return value.trim().toLowerCase();
}

function resolveOverride(
  appName: string,
  overrides?: AppCategoryOverrides,
): AppCategoryOverride | null {
  if (!overrides) return null;
  const key = normalizeAppKey(appName);
  if (!key) return null;
  return overrides[key] ?? null;
}

function buildOverrideClassification(
  appName: string,
  override: AppCategoryOverride,
): AppClassification {
  const title =
    override.category === "work"
      ? "Productive Screen Time"
      : (CATEGORY_TITLES[override.category] ?? "Screen Time");
  const isProductive = override.category === "work";
  return {
    title,
    description: appName,
    category: override.category,
    isDistraction: false,
    isWork: isProductive,
    isProductive,
    confidence: override.confidence,
  };
}

export function classifyAppUsage(
  appName: string,
  overrides?: AppCategoryOverrides,
): AppClassification {
  const override = resolveOverride(appName, overrides);
  if (override && override.confidence >= OVERRIDE_CONFIDENCE_MIN) {
    return buildOverrideClassification(appName, override);
  }

  const isDistraction = appMatchesList(appName, DISTRACTION_APPS);
  const isWork =
    appMatchesList(appName, WORK_APPS) ||
    appMatchesList(appName, PRODUCTIVE_APPS);

  if (isDistraction) {
    return {
      title: "Doom Scroll",
      description: appName,
      category: "digital",
      isDistraction: true,
      isWork: false,
      isProductive: false,
      confidence: 0.75,
    };
  }

  if (isWork) {
    return {
      title: "Productive Screen Time",
      description: appName,
      category: "work",
      isDistraction: false,
      isWork: true,
      isProductive: true,
      confidence: 0.7,
    };
  }

  return {
    title: "Screen Time",
    description: appName,
    category: "digital",
    isDistraction: false,
    isWork: false,
    isProductive: false,
    confidence: 0.55,
  };
}
