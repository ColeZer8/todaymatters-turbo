# JWT Token Refresh - Background/Foreground Handling

## Overview

This document describes the AppState listener implementation that ensures tokens are refreshed when the app returns from background.

## Problem

When an app is in the background for an extended period:
- Tokens may expire while the app is inactive
- Auto-refresh may not trigger immediately when app returns to foreground
- User may experience authentication errors after backgrounding

## Solution

Added AppState listener in `apps/mobile/src/app/_layout.tsx` that:
- Monitors app state changes (active, background, inactive)
- Refreshes session when app returns to foreground
- Ensures tokens are valid after background periods

## Implementation

### AppState Listener

```typescript
import { AppState, AppStateStatus } from 'react-native';
import { refreshSession } from '@/lib/supabase/session';

useEffect(() => {
  const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground - refresh session if needed
      const session = useAuthStore.getState().session;
      if (session) {
        try {
          await refreshSession();
        } catch (error) {
          console.error('Failed to refresh session on foreground:', error);
        }
      }
    }
  });

  return () => {
    subscription.remove();
  };
}, []);
```

## Behavior

### App State Transitions

1. **Background → Foreground**
   - AppState changes to `active`
   - Listener checks if session exists
   - Attempts to refresh session
   - If refresh fails, user may be signed out

2. **Foreground → Background**
   - AppState changes to `background` or `inactive`
   - No action taken (session persists)

3. **Foreground → Foreground** (no background)
   - No AppState change
   - No refresh triggered (auto-refresh handles this)

## Benefits

1. **Seamless Experience** - Users don't see auth errors after backgrounding
2. **Proactive Refresh** - Tokens refreshed before they're needed
3. **Error Prevention** - Reduces authentication failures after background periods

## Edge Cases Handled

### Long Background Periods

If app is backgrounded for >1 hour:
- Token may have expired
- Refresh will fail if refresh token also expired
- User will be signed out automatically
- Will need to sign in again

### Network Issues

If network is unavailable when app returns to foreground:
- Refresh attempt will fail
- Error is logged but doesn't crash app
- Auto-refresh will retry when network is available

### No Session

If no session exists when app returns to foreground:
- No refresh attempt is made
- User remains signed out
- Normal auth flow applies

## Testing

### Test: Background/Foreground Refresh

1. Sign in to the app
2. Put app in background for 5+ minutes
3. Return app to foreground
4. Check console logs for refresh attempt
5. Verify session is still valid
6. Make an API call to confirm token works

### Test: Long Background Period

1. Sign in to the app
2. Put app in background for >1 hour
3. Return app to foreground
4. Verify refresh is attempted
5. If refresh fails, verify user is signed out
6. Verify navigation to login screen

### Test: Network Offline

1. Sign in to the app
2. Disable network
3. Put app in background
4. Return app to foreground
5. Verify refresh attempt fails gracefully
6. Enable network
7. Verify auto-refresh works when network returns

## Related Files

- `apps/mobile/src/app/_layout.tsx` - AppState listener implementation
- `apps/mobile/src/lib/supabase/session.ts` - Refresh session function
- `apps/mobile/src/stores/auth-store.ts` - Auth state management

## Notes

- AppState listener is cleaned up on component unmount
- Refresh only happens when app becomes active (not on every state change)
- Existing session is checked before attempting refresh
- Errors are logged but don't crash the app

