# Onboarding continue glitch on device

- Status: In Progress
- Owner: Codex
- Started: 2025-12-15
- Completed: -

## Objective

Fix the visual glitch that appears on a physical iPhone when pressing Continue during onboarding, ensuring the flow transitions smoothly like the simulator without layout or animation artifacts.

## Plan

1. Reproduce or reason through the physical-device-only glitch by reviewing onboarding navigation, transitions, and platform-specific styles.
2. Inspect related components and animations to identify layout/animation issues that differ between simulator and device builds.
3. Implement and verify a fix, then validate via available tests or sanity checks.

## Done Criteria

- Continue tap during onboarding no longer causes a visual glitch on a physical iPhone.
- Navigation and animations remain smooth on simulator and device builds.
- Lint/type checks stay passing.

## Progress

- 2025-12-15: Logged objective and plan; starting investigation.
- 2025-12-15: Reviewed onboarding layouts; likely flicker comes from the keyboard staying open when tapping Continue. Added keyboard dismissal + ScrollView inset handling to smooth transitions.

## Verification

- 2025-12-15: `pnpm lint -- --filter=mobile` (Turbo reported no lint targets; no tasks executed).

## Outcomes

- Pending (awaiting additional verification).

## Follow-ups

- Pending.
