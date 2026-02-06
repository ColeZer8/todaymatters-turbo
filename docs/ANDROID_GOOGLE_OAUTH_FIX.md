# Android Google OAuth Fix

## Problem
Google sign-in works on iOS but instantly fails on Android without even opening the Google sign-in popup.

## Root Cause
The `makeRedirectUri()` function from `expo-auth-session` can generate different redirect URIs on iOS vs Android:
- **iOS**: Uses the app scheme directly (`todaymatters://`)
- **Android**: May use the package name format (`com.todaymatters.mobile://`) or other variations

If the redirect URI generated on Android isn't in Supabase's allowed Redirect URLs list, Supabase rejects the request immediately — before the browser even opens.

## Solution

### 1. Code Fix (Already Applied)
Updated `apps/mobile/src/lib/supabase/auth.ts` to use an explicit, consistent redirect URI:

```typescript
const getOAuthRedirectUri = (): string => {
  // Always use the app scheme for consistency across platforms
  return "todaymatters://auth/callback";
};
```

This ensures both iOS and Android use the same redirect URI.

### 2. Supabase Dashboard Configuration (REQUIRED)

**You MUST add these redirect URLs to Supabase:**

1. Go to: https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk/auth/url-configuration
2. Under "Redirect URLs", add ALL of these:

```
todaymatters://
todaymatters://auth/callback
todaymatters://auth/confirm
todaymatters://oauth/google/success
todaymatters://oauth/google/error
todaymatters://reset-password
```

3. Click **Save**

### 3. Verify Google Provider is Enabled

1. Go to: https://supabase.com/dashboard/project/bqbbuysyiyzdtftctvdk/auth/providers
2. Ensure **Google** is enabled with valid OAuth credentials

### 4. Rebuild the App

After making these changes:
```bash
# Clear the build cache
pnpm --filter mobile start --clear

# Rebuild Android
eas build --profile preview --platform android
```

## Testing

1. Install the new build on an Android device
2. Tap "Continue with Google"
3. The Google sign-in popup should now appear
4. Complete sign-in
5. Verify you're redirected back to the app

## Debugging

If it still fails, check the Metro logs for these debug messages:
- `🔐 Starting OAuth flow:` - Shows the redirect URI being used
- `🔐 Supabase OAuth error:` - Shows any errors from Supabase
- `🔐 Browser session error:` - Shows any errors opening the browser

The logs will help identify if:
- The redirect URI is correct
- Supabase is returning an error (e.g., "redirect URL not allowed")
- The browser is failing to open (Chrome issues on Android)

## Related Files
- `apps/mobile/src/lib/supabase/auth.ts` - OAuth implementation
- `apps/mobile/app.config.js` - App scheme configuration
- `apps/mobile/android/app/src/main/AndroidManifest.xml` - Android deep link setup
