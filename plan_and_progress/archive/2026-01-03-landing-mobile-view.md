# Landing: mobile viewport layout polish (no desktop changes)

- Status: Completed
- Owner: cursor-agent
- Started: 2026-01-03
- Completed: 2026-01-03

## Objective

Make the landing page look great on **mobile viewport widths** (no cropping/overflow; all content visible), while keeping **desktop/tablet (md+) unchanged**.

## Plan

1. Reproduce the issues at mobile viewport widths (e.g. 390×844) and identify which sections overflow/crop.
2. Apply mobile-only Tailwind adjustments (base classes / `sm:`) while preserving existing `md:`+ behavior.
3. Spot-check desktop and mobile to ensure parity and no regressions.

## Done Criteria

- No major cropping/hidden content on mobile across the key landing sections.
- Desktop layout is unchanged (md+ remains identical).

## Progress

- 2026-01-03: Fixed mobile viewport clipping on sticky sections by making overflow visible vertically on mobile while preserving md+ overflow behavior.

## Verification

- Manual QA: check at 390×844 and 1280×800; confirm all sections are readable and aligned.

## Outcomes

- `apps/landing/src/components/ScrollShowcase.tsx`: Mobile-only overflow adjustments to prevent clipping of phone shadows while keeping desktop unchanged.
- `apps/landing/src/components/AIPreview.tsx`: Same mobile-only overflow adjustments for parity.

## Follow-ups

- None.

