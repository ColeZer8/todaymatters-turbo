export const ONBOARDING_TOTAL_STEPS = 11;

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
  routine: 10,
  idealDay: 11,
} as const;

export type OnboardingStepKey = keyof typeof ONBOARDING_STEPS;
