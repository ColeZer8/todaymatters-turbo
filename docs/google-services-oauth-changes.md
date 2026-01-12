# Google Services OAuth Wiring (Mobile)

## Summary

This change adds a Google services OAuth helper module, a small callback state store, and wires deep-link handling into the app root. It does not add UI or alter existing screens.

## Files Added

- `apps/mobile/src/lib/google-services-oauth.ts`
  - Builds the OAuth start URL using `EXPO_PUBLIC_OAUTH_API_BASE_URL`.
  - Starts the OAuth flow by calling the backend start endpoint with `Authorization: Bearer <supabase_access_token>` to obtain a redirect URL, then opens the browser to start consent.
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
- Backend start endpoint requires `Authorization: Bearer <token>` header (Supabase access token).
- Deep links are recognized by host `oauth` and path prefix `google/`.
- Success callbacks read the `services` query param and normalize values.
- Error callbacks read the `error` query param.

## Configuration Dependencies

- `EXPO_PUBLIC_OAUTH_API_BASE_URL` (or env-specific override in `app.config.js`).

## Testing

- `pnpm --filter mobile lint` (warnings in existing files; no new lint errors from the OAuth changes).
- Manual device/browser OAuth flow tested: ✅ Mobile app successfully opens Google OAuth consent URL.
- **Known Issue (Backend/Google Config)**: After user enters email on Google sign-in page, Google returns 500 error at `counts.google.com`. This is **NOT a mobile app issue** - mobile correctly:
  1. Calls backend `/oauth2/google/start` with `Authorization: Bearer <token>`
  2. Receives valid Google OAuth URL (`accounts.google.com/v3/signin/identifier?...`)
  3. Opens that URL in browser
  4. User sees Google sign-in and enters email
  5. **Google then returns 500** (this happens on Google's servers, not in mobile app)

### Backend/Google OAuth Configuration Checklist

To fix the 500 error, backend team needs to verify:

1. **Google Cloud Console OAuth Client Configuration**:
   - Redirect URI must exactly match: `https://vrlacb5232.execute-api.us-east-1.amazonaws.com/oauth2/google/callback`
   - OAuth consent screen must be configured and in "Testing" mode
   - Test users must be added in Google Cloud Console (not just backend allowlist)
   - Scopes must be enabled/verified in Google Cloud Console

2. **Google Workspace/Domain Configuration**:
   - If using `hd=thedatagroup.cloud`, verify the domain is properly configured in Google Cloud/Workspace
   - Consider removing `hd` parameter for testing with consumer gmail accounts

3. **OAuth Flow Parameters**:
   - Verify `client_id` matches the one configured in Google Cloud Console
   - Verify `redirect_uri` in OAuth URL matches what's in Google Cloud Console
   - Verify requested scopes are approved/verified in Google Cloud Console

4. **Backend Logging**:
   - Check backend logs when user enters email on Google sign-in page
   - Look for any errors when Google tries to call `/oauth2/google/callback`
   - Verify backend is correctly handling the OAuth callback and redirecting to deep link
