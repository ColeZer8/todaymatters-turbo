export const ONBOARDING_TOTAL_STEPS = 12;

// Temporary dev flag for skipping onboarding
export const DEV_SKIP_ONBOARDING = true; 

export const ONBOARDING_STEPS = {
  permissions: 1,
  setupQuestions: 2,
  dailyRhythm: 3,
  joy: 4,
  drains: 5,
  yourWhy: 6,
  focusStyle: 7,
  coachPersona: 8,
  morningMindset: 9,
  goals: 10,
  routine: 11,
  idealDay: 12,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;
