# Sign-in page launch

- Status: In Progress
- Owner: Codex
- Started: 2025-11-26
- Completed: ->

## Objective

Ship a 1:1 replica of the provided Today Matters sign-in screen, aligned to the existing theme and Supabase auth setup, and make it the first screen users see.

## Plan

1. Review current theme, components, and auth/navigation flow to align the new screen.
2. Build the sign-in UI with atomic components (inputs, buttons, layout) matching the provided design and wire to Supabase auth actions.
3. Make the sign-in screen the app entry point and navigate to the home experience after auth; validate layout on device sizes.

## Done Criteria

- Sign-in screen visually matches the provided design and Today Matters styling.
- Email/password submission calls Supabase sign-in; social buttons invoke OAuth.
- Sign-in is the initial route; successful auth flows into the home experience.
- No lint/type errors introduced.

## Progress

- 2025-11-26: Reviewed theme, components, auth store, and routing to prep sign-in implementation.
- 2025-11-26: Built the sign-in template plus atoms/molecules, wired Supabase email + OAuth flows, and rerouted the app to land on the new screen before home.
- 2025-11-26: Added a themed create-account screen with Supabase sign-up wiring and navigation between sign-in/sign-up.

## Verification

- `pnpm --filter mobile lint` (fails: None of the selected packages has a "lint" script)

## Outcomes

- Pending

## Follow-ups

- Pending
