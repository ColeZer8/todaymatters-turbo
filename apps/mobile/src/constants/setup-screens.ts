export const SETUP_SCREENS_TOTAL_STEPS = 11;

// “Meeting flow” (subset of onboarding) — only these screens are intended to be visible/reachable for now.
export const SETUP_SCREENS_STEPS = {
  explainerVideo: 1,
  permissions: 2,
  coreValues: 3,
  coreCategories: 4,
  valuesScores: 5,
  goals: 6,
  goalWhys: 7,
  idealDay: 8,
  dailyRhythm: 9,
  myChurch: 10,
  aiSummary: 11,
} as const;

export type SetupScreensStepKey = keyof typeof SETUP_SCREENS_STEPS;

