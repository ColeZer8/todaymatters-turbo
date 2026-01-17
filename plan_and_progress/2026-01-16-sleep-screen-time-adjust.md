# Sleep screen-time adjustment

- Status: In Progress
- Owner: cole
- Started: 2026-01-16
- Completed: -

## Objective

When screen time overlaps sleep, show it as a Screen Time block and shift the sleep start accordingly.

## Plan

1. Inspect screen time derivation for sleep adjustments.
2. Implement overlap-based split/shift logic with thresholds.
3. Verify with sample data.

## Done Criteria

- Screen time overlaps sleep produce a Screen Time block.
- Sleep events start after significant phone usage instead of overlapping.
- Short pickups do not split sleep.

## Progress

- 2026-01-16: Added sleep start adjustment for significant screen time overlap (Android usage summaries too).
- 2026-01-16: Suppressed sleep blocks when usage covers most of scheduled sleep.
- 2026-01-16: Also remove overlapping existing sleep actuals when overridden.
- 2026-01-16: Always filter overlapping actual sleep and force override blocks.
- 2026-01-16: Always drop actual sleep blocks and replace with sleep-screen-time blocks.
- 2026-01-16: Convert unknown gaps within sleep schedule to interrupted sleep.
- 2026-01-16: Convert unknown gaps with productive usage to productive blocks.
- 2026-01-16: Actual blocks now open Review Time on tap.

## Verification

- Not run yet.

## Outcomes

- Shift sleep start to the end of early screen time sessions and insert a Screen Time block.
- Keep short/nighttime pickups from shifting sleep.
- Replace "Productive" sleep annotations with late-start phrasing.
- Replace fully-overlapped sleep with Screen Time blocks and “Sleep scheduled” descriptions.

## Follow-ups

- None.
