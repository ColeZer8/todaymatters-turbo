# JWT Token Refresh - Auth Store Enhancements

## Overview

This document describes the enhancements made to the auth store (`apps/mobile/src/stores/auth-store.ts`) to improve token refresh handling and logging.

## Changes Made

### 1. Enhanced Auth State Change Handler

**Before:**
- Generic handling of all auth events
- Basic logging in dev mode
- No specific handling for `TOKEN_REFRESHED`

**After:**
- Explicit handling for each auth event type
- Detailed logging for `TOKEN_REFRESHED` events
- Better error handling for refresh failures

### 2. Explicit Event Handling

Added specific handling for:
- `INITIAL_SESSION` - Logs restored session info
- `SIGNED_IN` - Logs sign-in event
- `SIGNED_OUT` - Clears session and logs sign-out
- `TOKEN_REFRESHED` - Logs refresh with new expiry time
- `USER_UPDATED` - Logs user update events

### 3. Improved Logging

Enhanced dev logging includes:
- Event type
- Session presence
- User ID
- Token expiry timestamp
- Specific messages for token refresh events

### 4. Error Handling

Better error handling for:
- Refresh token failures
- Session restoration failures
- Auth state change errors

## Code Changes

### Auth State Change Handler

```typescript
supabase.auth.onAuthStateChange((event, nextSession) => {
  if (__DEV__) {
    console.log('🔍 Supabase onAuthStateChange:', {
      event,
      hasSession: !!nextSession,
      userId: nextSession?.user?.id ?? null,
      expiresAt: nextSession?.expires_at ?? null,
    });
  }

  switch (event) {
    case 'SIGNED_OUT':
      get().setSession(null);
      if (__DEV__) {
        console.log('👋 User signed out');
      }
      break;
      
    case 'TOKEN_REFRESHED':
      get().setSession(nextSession);
      if (__DEV__) {
        console.log('🔄 Token refreshed, new expiry:', nextSession?.expires_at);
      }
      break;
      
    case 'SIGNED_IN':
      get().setSession(nextSession);
      if (__DEV__) {
        console.log('✅ User signed in:', nextSession?.user?.email);
      }
      break;
      
    case 'INITIAL_SESSION':
      get().setSession(nextSession);
      if (__DEV__) {
        console.log('🚀 Restored session for:', nextSession?.user?.email);
      }
      break;
      
    case 'USER_UPDATED':
      get().setSession(nextSession);
      if (__DEV__) {
        console.log('👤 User updated:', nextSession?.user?.email);
      }
      break;
      
    default:
      // Handle other events generically
      get().setSession(nextSession);
  }
});
```

## Benefits

1. **Better Debugging** - Clear logs for each auth event type
2. **Token Refresh Visibility** - Explicit logging when tokens are refreshed
3. **Error Tracking** - Better error messages for refresh failures
4. **Maintainability** - Clearer code structure with explicit event handling

## Testing

### Verify Token Refresh Logging

1. Sign in to the app
2. Wait for token refresh (or trigger manually)
3. Check console logs for `🔄 Token refreshed` message
4. Verify expiry timestamp is updated

### Verify Sign Out Handling

1. Sign in to the app
2. Trigger sign out
3. Check console logs for `👋 User signed out` message
4. Verify session is cleared

## Related Files

- `apps/mobile/src/lib/supabase/client.ts` - Supabase client configuration
- `apps/mobile/src/lib/supabase/session.ts` - Session utility functions
- `apps/mobile/src/app/_layout.tsx` - App initialization

