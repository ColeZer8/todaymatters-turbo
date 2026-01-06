# Google Services OAuth Wiring (Mobile)

## Summary

This change adds a Google services OAuth helper module, a small callback state store, and wires deep-link handling into the app root. It does not add UI or alter existing screens.

## Files Added

- `apps/mobile/src/lib/google-services-oauth.ts`
  - Builds the OAuth start URL using `EXPO_PUBLIC_OAUTH_API_BASE_URL`.
  - Opens the browser to start consent.
  - Parses deep-link callbacks like `todaymatters://oauth/google/success` or `todaymatters://oauth/google/error`.
  - Provides a helper to register listeners for initial URL + in-app URL events.

- `apps/mobile/src/stores/google-services-oauth-store.ts`
  - Zustand store that tracks `isProcessing` and the latest OAuth result.

## Files Updated

- `apps/mobile/src/app/_layout.tsx`
  - Registers the Google services OAuth deep-link handler alongside Supabase auth.
  - Writes results into the OAuth store for UI or feature use later.

- `apps/mobile/src/stores/index.ts`
  - Exports the new OAuth store.

## Behavior Details

- OAuth start URL is built as: `<OAUTH_API_BASE_URL>/oauth2/google/start?services=...`
- Deep links are recognized by host `oauth` and path prefix `google/`.
- Success callbacks read the `services` query param and normalize values.
- Error callbacks read the `error` query param.

## Configuration Dependencies

- `EXPO_PUBLIC_OAUTH_API_BASE_URL` (or env-specific override in `app.config.js`).

## Testing

- `pnpm --filter mobile lint` (warnings in existing files; no new lint errors from the OAuth changes).
- Manual device/browser OAuth flow not run (requires backend endpoint + deep link).
