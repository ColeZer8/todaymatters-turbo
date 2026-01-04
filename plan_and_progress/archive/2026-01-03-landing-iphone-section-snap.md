# Landing iPhone section snap parity

- Status: Completed
- Owner: cursor-agent
- Started: 2026-01-03
- Completed: 2026-01-03

## Objective

Make the iPhone/feature scroller section snap with the same “panel-by-panel” feel as the “Step into your calling / Gentle coaching …” section, without changing any other sections.

## Plan

1. Mirror the `AIPreview` snap-point overlay structure in `ScrollShowcase`.
2. Verify scroll snaps per panel and the rest of the page is unchanged.

## Done Criteria

- Scrolling the iPhone section snaps cleanly between each feature panel (like the AI preview panels).
- No layout/scroll behavior changes outside the iPhone section.

## Progress

- 2026-01-03: Implemented snap-point overlay in the iPhone `#features` section to match `AIPreview` panel snapping.

## Verification

- Manual QA: scroll `http://localhost:3000` through the iPhone section and confirm snapping locks each panel.
 - Programmatic check: confirmed 4 snap points with `scrollSnapStop: always`, `scrollSnapAlign: start`, and scroll snaps to each panel boundary.

## Outcomes

- `apps/landing/src/components/ScrollShowcase.tsx`: Added snap-point overlay matching `AIPreview` structure.

## Follow-ups

- None.

