export const ONBOARDING_TOTAL_STEPS = 13;

// Temporary dev flag for skipping onboarding
export const DEV_SKIP_ONBOARDING = true; 

export const ONBOARDING_STEPS = {
  permissions: 1,
  setupQuestions: 2,
  name: 3,
  dailyRhythm: 4,
  joy: 5,
  drains: 6,
  yourWhy: 7,
  focusStyle: 8,
  coachPersona: 9,
  morningMindset: 10,
  goals: 11,
  routine: 12,
  idealDay: 13,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;
