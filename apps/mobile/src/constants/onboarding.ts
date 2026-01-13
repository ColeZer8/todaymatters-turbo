export const ONBOARDING_TOTAL_STEPS = 23;

// Temporary dev flag for skipping onboarding
export const DEV_SKIP_ONBOARDING = true;

export const ONBOARDING_STEPS = {
  explainerVideo: 1,
  permissions: 2,
  connectGoogleServices: 3,
  coreValues: 4,
  coreCategories: 5,
  subCategories: 6,
  goals: 7,
  goalWhys: 8,
  idealDay: 9,
  valuesScores: 10,
  aiSummary: 11,
  name: 12,
  vipContacts: 13,
  myChurch: 14,
  setupQuestions: 15,
  dailyRhythm: 16,
  joy: 17,
  drains: 18,
  yourWhy: 19,
  focusStyle: 20,
  coachPersona: 21,
  morningMindset: 22,
  routine: 23,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;
