# Landing: iPhone mockup mobile parity + mobile callouts (no desktop changes)

- Status: Completed
- Owner: cursor-agent
- Started: 2026-01-03
- Completed: 2026-01-03

## Objective

On the landing page iPhone/features section, make the iPhone mockup keep the **same proportions/shape** on mobile as desktop, and ensure the same “context” elements (callout + stats) are visible in a mobile-friendly layout, while keeping **desktop (md+/lg+) unchanged**.

## Plan

1. Preserve iPhone mockup proportions on mobile by scaling the same “desktop-built” mockup down (so radii/padding/bezels scale consistently).
2. Add mobile-only stacked callout + stats under the phone (instead of desktop-only floating layout).
3. Verify at mobile (375×667, 390×844) and desktop (1280×800).

## Done Criteria

- iPhone mockup looks proportionally identical on mobile vs desktop (no “shape change”).
- Mobile view shows callout + key stats without clipping/overlap.
- Desktop layout is unchanged.

## Progress

- 2026-01-03: Implemented mobile scale-based iPhone mockup parity + mobile-only callout block; verified desktop is unchanged.

## Verification

- Manual QA: compare mobile and desktop iPhone section (shape + visibility).

## Outcomes

- `apps/landing/src/components/ScrollShowcase.tsx`: iPhone mockup now preserves desktop proportions on mobile via transform scaling; mobile-only callout block ensures context is visible without affecting desktop.

## Follow-ups

- None.
