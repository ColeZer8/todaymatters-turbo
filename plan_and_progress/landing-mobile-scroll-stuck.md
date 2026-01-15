# Landing (Mobile) Scroll Stuck Fix

- Status: In Progress
- Owner: colezerman
- Started: 2026-01-14
- Completed: -

## Objective

Fix the landing page scroll getting “stuck” on iPhone (mobile Safari / iOS simulator) while keeping the desktop experience unchanged.

## Plan

1. Reproduce in iPhone 16e simulator and capture screenshots.
2. Identify the scroll lock source (CSS scroll snapping / overflow / overlays / JS scroll handlers).
3. Apply a mobile-only fix.
4. Verify on iPhone 16e simulator that scrolling is smooth and not sticky/stuck.

## Done Criteria

- On iPhone 16e (Simulator), the landing page scrolls smoothly through all sections without getting stuck.
- Desktop layout/scroll behavior is unchanged.

## Progress

- 2026-01-14: Reproduced “stuck” scrolling on iPhone 16e simulator while viewing the deployed landing page in Safari.
- 2026-01-14: Identified global mandatory CSS scroll snapping (`scroll-snap-type: y mandatory`) as a likely cause on iOS Safari.
- 2026-01-14: Disabled scroll snapping for mobile widths only.
- 2026-01-14: Verified in iPhone 16e simulator that the page scrolls down through multiple sections after the change.
- 2026-01-14: Verified reference mobile scrolling behavior on [Bevel](https://www.bevel.health/) for comparison.
- 2026-01-14: Improved mobile formatting for the sticky scroll sections by removing transform scaling that caused large blank layout space, reducing the transition fade height on mobile, and using `svh`-based min-heights for iOS Safari.
- 2026-01-14: Removed the iOS Safari “white strip” above the dark sticky section by switching the page background to dark while `AIPreview` is in view.

## Verification

- Manual QA: iPhone 16e simulator Safari scroll through the landing page (multiple scroll gestures).
- Manual QA: iPhone 16e simulator Safari scroll from Hero → Features (sticky) → next panels; confirm no large blank space or “stuck” behavior.
- Commands (once ready):
  - `pnpm --filter landing lint`
  - `pnpm --filter landing check-types`
  - Notes: `pnpm --filter landing lint` currently reports warnings unrelated to this change; `pnpm --filter landing check-types` passes.

## Outcomes

- Mobile-only CSS override disables scroll snapping to avoid iOS Safari “stuck scroll” behavior while preserving the desktop snap experience.

## Follow-ups

- Compare against the reference site mobile behavior: [Bevel](https://www.bevel.health/).
- If any remaining “sticky” sections still feel sticky on iOS, consider conditionally disabling scroll snap via `ScrollSnapController` based on input type (coarse pointer), not just width.

