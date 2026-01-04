# Landing: more varied testimonials

- Status: Completed
- Owner: cursor-agent
- Started: 2026-01-03
- Completed: 2026-01-03

## Objective

Reduce visible repetition in the “Crafted with Care” testimonials marquee by adding more unique 5-star reviews.

## Plan

1. Expand the `testimonials` dataset with additional unique entries.
2. Keep the marquee behavior intact (still loops), but with more variety per loop.

## Done Criteria

- The testimonials section feels noticeably less repetitive while scrolling.
- All testimonials remain 5-star reviews and render without layout regressions.

## Progress

- 2026-01-03: Added more unique 5-star reviews to reduce visible repetition in the marquee loop.

## Verification

- Manual QA: scroll through the testimonials section and confirm variety across both marquee rows.

## Outcomes

- `apps/landing/src/components/Testimonials.tsx`: Expanded the base testimonials dataset (now 20 unique reviews).

## Follow-ups

- None.

