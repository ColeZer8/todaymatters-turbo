# JWT Token Refresh Implementation

## Overview

This document describes the automatic JWT token refresh implementation for the Today Matters mobile app. The Supabase SDK automatically refreshes access tokens before they expire, ensuring seamless user experience without requiring re-authentication.

## Token Lifecycle

```
Login → Access Token (1h) → Auto Refresh → New Access Token
         ↓
    Refresh Token (longer lived)
         ↓
    If refresh fails → Re-authenticate
```

## Implementation Details

### 1. SDK Auto-Refresh Configuration

**Location:** `apps/mobile/src/lib/supabase/client.ts`

The Supabase client is configured with:
- `autoRefreshToken: true` - Enables automatic token refresh before expiry
- `persistSession: true` - Persists session to AsyncStorage
- `detectSessionInUrl: false` - Disabled for React Native (not needed)

### 2. Auth State Change Listener

**Location:** `apps/mobile/src/stores/auth-store.ts`

The auth store listens to all auth state changes:
- `INITIAL_SESSION` - App started with existing session
- `SIGNED_IN` - User signed in
- `SIGNED_OUT` - User signed out (triggers navigation to login)
- `TOKEN_REFRESHED` - Token was automatically refreshed (logged for debugging)
- `USER_UPDATED` - User data was updated

### 3. Manual Refresh Function

**Location:** `apps/mobile/src/lib/supabase/session.ts`

Provides `refreshSession()` function for manual token refresh with proper error handling:
- Handles `refresh_token_not_found` errors
- Handles `invalid_refresh_token` errors
- Handles `refresh_token_already_used` errors
- Automatically signs out user if refresh fails

### 4. Pre-emptive Session Validation

**Location:** `apps/mobile/src/lib/supabase/session.ts`

Provides `getValidSession()` utility function:
- Checks if session exists
- Checks if token is about to expire (within 5 minutes)
- Automatically refreshes if needed
- Returns valid session or null

### 5. Background/Foreground Handling

**Location:** `apps/mobile/src/app/_layout.tsx`

AppState listener refreshes session when app returns from background:
- Listens for `active` state changes
- Refreshes session when app comes to foreground
- Ensures tokens are valid after app was in background

### 6. Navigation on Sign Out

**Location:** `apps/mobile/src/stores/auth-store.ts`

When `SIGNED_OUT` event is detected:
- Clears session from store
- Navigation is handled automatically by Expo Router based on `isAuthenticated` state

## Usage Examples

### Using Manual Refresh

```typescript
import { refreshSession } from '@/lib/supabase/session';

try {
  const session = await refreshSession();
  if (session) {
    console.log('Session refreshed successfully');
  }
} catch (error) {
  console.error('Failed to refresh session:', error);
  // User will be signed out automatically
}
```

### Using Pre-emptive Session Validation

```typescript
import { getValidSession } from '@/lib/supabase/session';

async function fetchUserData() {
  const session = await getValidSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  // Make API call with valid token
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single();
    
  return data;
}
```

## Error Handling

Common refresh errors and their handling:

- `refresh_token_not_found` → User signed out, redirect to login
- `invalid_refresh_token` → User signed out, redirect to login
- `refresh_token_already_used` → User signed out, redirect to login

All refresh failures automatically trigger sign out and navigation to login screen.

## Testing

### Test: Verify Auto-Refresh

1. Sign in to the app
2. Wait for token to be near expiry (or mock time)
3. Make an API call
4. Verify `TOKEN_REFRESHED` event fires in logs
5. Verify API call succeeds with new token

### Test: Handle Refresh Failure

1. Sign in to the app
2. Invalidate refresh token (clear from storage)
3. Wait for token expiry
4. Verify `SIGNED_OUT` event fires
5. Verify redirect to login screen

### Test: Background/Foreground

1. Sign in to the app
2. Put app in background for >1 hour
3. Return app to foreground
4. Verify session is refreshed automatically
5. Verify user remains authenticated

## Files Modified

- `apps/mobile/src/lib/supabase/client.ts` - Auto-refresh configuration
- `apps/mobile/src/stores/auth-store.ts` - Enhanced auth state handling
- `apps/mobile/src/lib/supabase/session.ts` - New session utilities
- `apps/mobile/src/app/_layout.tsx` - AppState listener

## Related Documentation

- [Supabase Auth - Sessions](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase Auth - Token Refresh](https://supabase.com/docs/guides/auth/auth-helpers/nextjs#refreshing-sessions)

