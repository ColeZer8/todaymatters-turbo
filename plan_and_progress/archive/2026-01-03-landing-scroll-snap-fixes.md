# Landing scroll snap fixes (Designed for Daily Life + Crafted with care)

- Status: Completed
- Owner: cursor-agent
- Started: 2026-01-03
- Completed: 2026-01-03

## Objective

Improve landing page scrolling so:
- The user doesn’t easily overshoot “Designed for Daily Life”.
- The “Crafted with Care. Loved Everywhere.” section snaps to a consistently aligned position (no partial/misaligned snap).

## Plan

1. Locate current scroll/snap implementation for vertical sections + testimonials.
2. Adjust CSS/JS so section snap points are reliable and harder to overshoot.
3. Fix carousel snap alignment and verify in-browser.

## Done Criteria

- Keyboard/trackpad scroll reliably lands on “Designed for Daily Life” without skipping past it as often.
- “Crafted with Care” when snapped is consistently aligned (no “off-by-a-bit” left/right).
- No layout regressions on the landing page.

## Progress

- 2026-01-03: Implemented top-of-viewport snapping for “Designed for Daily Life” and “Crafted with Care” only; reverted global snap offset changes that impacted other sections.

## Verification

- Manual QA: Scroll through `http://localhost:3000` and observe snapping behavior around the two sections.
- Measured: both sections snap with `sectionTop = 0` (top aligned to viewport) and `scroll-snap-stop: always`.

## Outcomes

- Updated `DailyLifeGrid` + `Testimonials` to snap reliably and align to the top of the viewport, without changing other sections’ behavior.

## Follow-ups

- Consider adding a small visual scroll affordance or section nav if needed.

