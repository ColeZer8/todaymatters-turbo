export const SETUP_SCREENS_TOTAL_STEPS = 12;

// “Meeting flow” (subset of onboarding) — only these screens are intended to be visible/reachable for now.
export const SETUP_SCREENS_STEPS = {
  explainerVideo: 1,
  permissions: 2,
  connectGoogleServices: 3,
  coreValues: 4,
  coreCategories: 5,
  valuesScores: 6,
  goals: 7,
  goalWhys: 8,
  idealDay: 9,
  dailyRhythm: 10,
  myChurch: 11,
  aiSummary: 12,
} as const;

export type SetupScreensStepKey = keyof typeof SETUP_SCREENS_STEPS;

