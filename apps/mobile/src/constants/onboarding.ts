export const ONBOARDING_TOTAL_STEPS = 14;

// Temporary dev flag for skipping onboarding
export const DEV_SKIP_ONBOARDING = true; 

export const ONBOARDING_STEPS = {
  permissions: 1,
  connectGoogleServices: 2,
  setupQuestions: 3,
  name: 4,
  dailyRhythm: 5,
  joy: 6,
  drains: 7,
  yourWhy: 8,
  focusStyle: 9,
  coachPersona: 10,
  morningMindset: 11,
  goals: 12,
  routine: 13,
  idealDay: 14,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;
