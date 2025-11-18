# Home Screen Polish

- Status: In Progress
- Owner: Cole Zerman
- Started: 2025-11-17
- Completed: -

## Objective

Deliver a production-quality mobile home screen that reflects the Figma design 1:1, sets the tone for a professional productivity app, and proves the UI stack (Expo Router + NativeWind) is ready for complex flows.

## Plan

1. Import the new home experience from Figma, define the layout, and break it into atomic layers (atoms → molecules → organisms → template → page).
2. Build out the shared atoms/molecules with Tailwind-compliant styling and responsive/dark-mode considerations.
3. Assemble the home template/page, wire up hero/CTA sections, and integrate any placeholder data the design requires.
4. Implement initial button navigation + lightweight interactions needed for the demo and ensure Expo routing stays healthy.
5. Run lint/typecheck/format/expo smoke tests and tighten anything flagged.

## Done Criteria

- Home page visually matches the Figma reference at mobile breakpoints (spacing, typography, palette, and interaction states).
- Primary interactions (CTA buttons, navigation hotspots) feel smooth on device/simulator with proper touch feedback.
- Codebase respects the atomic architecture and Tailwind ordering rules with reusable building blocks.
- `pnpm lint`, `pnpm check-types`, and Expo start (`pnpm dev -- --filter=mobile`) pass with no regressions or Metro errors.

## Progress

- 2025-11-17: Captured objective, scope, and plan; waiting on Figma asset handoff to begin implementation.
- 2025-11-17: Reviewed the current Expo Router home page, confirmed atomic folders are placeholders, and noted the referenced `home-page-homepage.md` source is missing from the repo before starting implementation.
- 2025-11-17: Implemented atomic → page structure (atoms, molecules, organisms, template, and the Expo Router page) for the refreshed home experience and staged sample data that mirrors the provided reference.
- 2025-11-17: Tightened styling to match the “Design productivity” mock 1:1 (hero surface polish, action pill, metrics, upcoming list, and status chrome) after designer feedback.
- 2025-11-17: Rebuilt the top section to match the “Today Matters” Figma (status chrome, header actions, verse card, and What’s Next panel with gradients) per the updated reference.
- 2025-11-17: Removed the faux status rail, merged the header + verse into a single hero organism, and matched the Today Matters top block padding/radii with custom icon row treatments.
- 2025-11-17: Split the hero back into a white header card + dedicated verse pill, restored a single status rail, and re-tuned Next Steps to match the latest mock’s typography and spacing.
- 2025-11-17: Removed the duplicated status rail entirely, rebuilt the Today Matters header into a white pill under the real notch (with icon badges) and matched the verse/CTA spacing from the latest screenshot.
- 2025-11-17: Converted the header into the slim icon bar (avatar + five action buttons + badge) per the latest reference and tightened shadows so it sits flush under the device notch.
- 2025-11-17: Tweaked the action bar spacing/typography again (uppercase ticker + tighter circular buttons) to land on the senior-looking finish the PM asked for.
- 2025-11-17: Rebuilt the top bar to span edge-to-edge (no rounded capsule) with only the icons shown in Figma and dropped the subtitle so it matches the latest ref exactly.
- 2025-11-17: Applied the designer’s detailed spec: tightened the header blur/padding, rebuilt the verse gradient, reworked the What’s Next/CTA/hot card spacing, and normalized typography + shadows across the stack.
- 2025-11-17: Added the “Big 3” and “Communications” cards with the same styling language (tight radii, soft shadows, thin icons) to mirror the next section of the Figma file.
- 2025-11-17: Built the “How Your Day Is Going” agenda card beneath them with the segmented timeline/tile look from the mock.
- 2025-11-17: Made the day overview list scrollable inside the card so it matches the interaction shown in Figma.
- 2025-11-17: Applied another polish pass (improved gradients/shadows, tappable verse expansion, better card keys) for the top half of the screen.

## Verification

- 2025-11-17: `pnpm lint -- --filter=mobile` (passes but reports no lint targets configured in Turbo yet).
- 2025-11-17: `pnpm lint -- --filter=mobile` (re-run post-layout refresh; same Turbo warning about missing lint targets).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after reworking hero/template wiring; unchanged Turbo warning).
- 2025-11-17: `pnpm lint -- --filter=mobile` (post white-header/verse split; Turbo still reports the missing lint pipeline).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after removing faux notch + header refactor; Turbo warning unchanged).
- 2025-11-17: `pnpm lint -- --filter=mobile` (icon-bar update; Turbo still warns about missing lint tasks).
- 2025-11-17: `pnpm lint -- --filter=mobile` (post spacing polish; same Turbo warning).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after full-width bar change; Turbo warning persists).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after spec-alignment pass; Turbo still reports missing lint task configuration).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after adding Big 3 + Communications sections; Turbo warning unchanged).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after the day timeline addition; Turbo warning still present).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after gradients/shadow polish; same Turbo warning).
- 2025-11-17: `pnpm lint -- --filter=mobile` (after turning the day timeline into a scrollable list; Turbo still warns about lint config).

## Outcomes

- _Pending_: To be filled after implementation (link PRs/commits and summarize impact).

## Follow-ups

- Gather final iconography/imagery from design before wiring assets.
- Confirm backend/data placeholders needed for scheduling/AI widgets so UI scaffolding matches real data later.
