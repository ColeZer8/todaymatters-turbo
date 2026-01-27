# Hidden Voice Agent Toggle via Home Greeting

- Status: Completed
- Owner: Cole
- Started: 2025-12-22
- Completed: 2025-12-22

## Objective

Make ElevenLabs voice agent activation **invisible** in the UI, and ensure the microphone only starts when the user explicitly taps the Home greeting text (“Good afternoon, Paul”).

## Plan

1. Remove the global voice coach overlay UI (floating button + modal).
2. Add an invisible hitbox over the Home greeting text to toggle the agent on/off.
3. Ensure the mic/session ends when leaving the Home screen.

## Done Criteria

- Tapping the Home greeting text toggles agent session on/off.
- No visible ElevenLabs UI (no button, no modal).
- Mic does not start until the greeting is tapped.
- Session ends when leaving Home.

## Progress

- 2025-12-22: Removed visible voice UI overlay and added hidden greeting hitbox to toggle voice session.

## Verification

- `pnpm --filter mobile lint`
- `pnpm --filter mobile check-types`
- Manual: tap greeting to start/stop; confirm mic permission prompt appears; confirm no floating button/modal.

## Outcomes

- Voice agent is hidden behind the Home greeting tap; no floating button/modal; mic only starts after tap and ends when leaving Home.

## Follow-ups

- Add subtle UI affordance for active listening state (future).
