export const ONBOARDING_TOTAL_STEPS = 9;

export const ONBOARDING_STEPS = {
  setupQuestions: 1,
  dailyRhythm: 2,
  joy: 3,
  drains: 4,
  yourWhy: 5,
  focusStyle: 6,
  coachPersona: 7,
  morningMindset: 8,
  goals: 9,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;
